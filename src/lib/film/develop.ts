/**
 * The film look (docs/FILM-LOOK.md, D40), applied to every frame on the phone
 * before it is sealed. WebGL2, three steps:
 *   1. downscale ¼ + separable gaussian blur (twice) → a soft copy of the frame,
 *      used for the plastic-lens softness and the halation glow;
 *   2. one "develop" pass: softness, halation, tone curves (LUT), split toning,
 *      saturation, vignette, light leak, date stamp, then grain;
 *   3. read back through the canvas (the caller encodes the JPEG).
 * Curves and tints work on display (sRGB) values — that is where the stock
 * curves were drawn. No WebGL2 → the frame is returned untouched.
 */
import { buildLut } from './curve';
import { hash01, type Leak } from './leak';
import { drawStamp } from './stamp';
import type { FilmStock } from './stocks';

export interface DevelopOptions {
	stock: FilmStock;
	/** per-frame grain / leak seed */
	seed: string;
	/** date imprint text, or null for none */
	stamp: string | null;
	leak: Leak | null;
}

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const COPY = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src;
void main() { o = texture(src, uv); }`;

const BLUR = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src;
uniform vec2 dir;
void main() {
	vec3 s = texture(src, uv).rgb * 0.227027;
	s += (texture(src, uv + dir * 1.3846).rgb + texture(src, uv - dir * 1.3846).rgb) * 0.3162162;
	s += (texture(src, uv + dir * 3.2308).rgb + texture(src, uv - dir * 3.2308).rgb) * 0.0702703;
	o = vec4(s, 1.0);
}`;

const DEVELOP = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D img, soft, lut, stampTex;
uniform vec2 res;
uniform uint seed;
uniform vec3 shadowTint, highlightTint;
uniform float saturation, grainAmount, grainSize, vignette, softness, halation;
uniform vec4 stampRect;     // uv rect (x0, y0, x1, y1); empty = no stamp
uniform vec3 leak;          // dir.xy, reach (0 reach = no leak)
uniform float leakStrength;
const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);

// integer hash (pcg2d): no float-precision patterns at large pixel coordinates
uvec2 pcg2d(uvec2 v) {
	v = v * 1664525u + 1013904223u;
	v.x += v.y * 1664525u; v.y += v.x * 1664525u;
	v ^= v >> 16u;
	v.x += v.y * 1664525u; v.y += v.x * 1664525u;
	v ^= v >> 16u;
	return v;
}
float hash(ivec2 i) {
	uvec2 h = pcg2d(uvec2(i + 1048576) ^ uvec2(seed, seed * 747796405u));
	return float(h.x) * (1.0 / 4294967296.0);
}
float vnoise(vec2 p) {
	ivec2 i = ivec2(floor(p));
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i), b = hash(i + ivec2(1, 0));
	float c = hash(i + ivec2(0, 1)), d = hash(i + ivec2(1, 1));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec3 curve(vec3 c) {
	c = clamp(c, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
	return vec3(texture(lut, vec2(c.r, 0.5)).r, texture(lut, vec2(c.g, 0.5)).g, texture(lut, vec2(c.b, 0.5)).b);
}

void main() {
	vec3 c = texture(img, uv).rgb;
	vec3 b = texture(soft, uv).rgb;
	float aspect = res.x / res.y;
	vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
	float r2 = dot(q, q) / (0.25 * aspect * aspect + 0.25); // 1.0 in the corners

	// plastic lens: softer towards the edges
	c = mix(c, b, clamp(softness * r2 * 1.3, 0.0, 1.0));
	// halation: highlights bleed a red-orange glow
	c += halation * vec3(1.0, 0.32, 0.12) * smoothstep(0.62, 1.0, dot(b, LUM));

	c = curve(c);
	float l = dot(c, LUM);
	c += shadowTint * (1.0 - l) * (1.0 - l) + highlightTint * l * l;
	l = dot(c, LUM);
	c = mix(vec3(l), c, saturation);
	c *= 1.0 - vignette * smoothstep(0.15, 1.0, r2);

	// light leak: warm fog bleeding in from one edge (image space: y down)
	if (leak.z > 0.0) {
		vec2 ip = vec2(uv.x, 1.0 - uv.y) - 0.5;
		float d = dot(ip, leak.xy) + 0.5;                     // 1 at the leaking edge
		float wob = (vnoise(uv * 3.0 + 7.0) - 0.5) * 0.25;
		float t = smoothstep(1.0 - leak.z + wob, 1.05, d) * leakStrength;
		vec3 glow = mix(vec3(1.0, 0.62, 0.2), vec3(1.0, 0.16, 0.06), smoothstep(0.3, 1.0, t));
		c = 1.0 - (1.0 - c) * (1.0 - glow * t);
	}

	// date stamp, before grain — like a real imprint on the emulsion
	if (stampRect.z > stampRect.x && uv.x >= stampRect.x && uv.x <= stampRect.z && uv.y >= stampRect.y && uv.y <= stampRect.w) {
		vec4 s = texture(stampTex, (uv - stampRect.xy) / (stampRect.zw - stampRect.xy));
		c = 1.0 - (1.0 - c) * (1.0 - s.rgb * s.a);
	}

	// grain: clumped, strongest in the mid-tones, faintly coloured
	vec2 px = uv * res / grainSize;
	float n = (vnoise(px) + vnoise(px * 1.9 + 17.0)) - 1.0;
	float nc = vnoise(px * 0.7 + 31.0) - 0.5;
	l = dot(c, LUM);
	float mid = 1.0 - pow(abs(2.0 * l - 1.0), 2.0);
	c += (n + vec3(nc, -nc * 0.5, nc * 0.3) * 0.25) * grainAmount * (0.35 + 0.65 * mid);

	o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

type GL = WebGL2RenderingContext;

class Lab {
	readonly canvas = document.createElement('canvas');
	readonly gl: GL;
	#progs: Record<'copy' | 'blur' | 'develop', WebGLProgram>;
	#lutCache = new Map<FilmStock, WebGLTexture>();

	constructor() {
		const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false });
		if (!gl) throw new Error('WebGL2 unavailable');
		this.gl = gl;
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		this.#progs = { copy: this.#program(COPY), blur: this.#program(BLUR), develop: this.#program(DEVELOP) };
	}

	get maxSize(): number {
		return Math.min(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE));
	}

	#program(frag: string): WebGLProgram {
		const gl = this.gl;
		const sh = (type: number, src: string) => {
			const s = gl.createShader(type)!;
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
			return s;
		};
		const p = gl.createProgram()!;
		gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
		gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
		gl.bindAttribLocation(p, 0, 'p');
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
		return p;
	}

	texture(src: TexImageSource | null, w = 0, h = 0, data: Uint8Array | null = null): WebGLTexture {
		const gl = this.gl;
		const t = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, t);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // row 0 = bottom, like the framebuffer
		if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
		else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return t;
	}

	lut(stock: FilmStock): WebGLTexture {
		let t = this.#lutCache.get(stock);
		if (!t) {
			t = this.texture(null, 256, 1, buildLut(stock.curves));
			this.#lutCache.set(stock, t);
		}
		return t;
	}

	/** Draw `prog` into `target` (null = the canvas), binding textures in order. */
	pass(prog: 'copy' | 'blur' | 'develop', target: WebGLFramebuffer | null, w: number, h: number, textures: [string, WebGLTexture][], set?: (loc: (n: string) => WebGLUniformLocation | null) => void) {
		const gl = this.gl;
		const p = this.#progs[prog];
		gl.useProgram(p);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target);
		gl.viewport(0, 0, w, h);
		textures.forEach(([name, tex], i) => {
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.uniform1i(gl.getUniformLocation(p, name), i);
		});
		set?.((n) => gl.getUniformLocation(p, n));
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	target(w: number, h: number): { fb: WebGLFramebuffer; tex: WebGLTexture } {
		const gl = this.gl;
		const tex = this.texture(null, w, h);
		const fb = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		return { fb, tex };
	}
}

let lab: Lab | null | undefined;
function getLab(): Lab | null {
	if (lab === undefined) {
		try {
			lab = new Lab();
		} catch (e) {
			console.warn('film look disabled:', e);
			lab = null;
		}
	}
	return lab;
}

/** Whether frames will be developed on this device (for the dev panel). */
export function filmSupported(): boolean {
	return getLab() !== null;
}

/**
 * Develop one frame. Returns a canvas of the same size holding the developed
 * image — or the source untouched when WebGL2 is unavailable.
 */
export function develop(src: HTMLCanvasElement, opts: DevelopOptions): HTMLCanvasElement {
	const L = getLab();
	if (!L) return src;
	const gl = L.gl;
	const { width: w, height: h } = src;
	if (w > L.maxSize || h > L.maxSize) return src;
	L.canvas.width = w;
	L.canvas.height = h;

	const img = L.texture(src);
	const sw = Math.max(1, Math.round(w / 4));
	const sh = Math.max(1, Math.round(h / 4));
	const a = L.target(sw, sh);
	const b = L.target(sw, sh);
	L.pass('copy', a.fb, sw, sh, [['src', img]]);
	for (let i = 0; i < 2; i++) {
		const spread = 1 + i * 1.5;
		L.pass('blur', b.fb, sw, sh, [['src', a.tex]], (u) => gl.uniform2f(u('dir'), spread / sw, 0));
		L.pass('blur', a.fb, sw, sh, [['src', b.tex]], (u) => gl.uniform2f(u('dir'), 0, spread / sh));
	}

	// the stamp sits bottom-right on the frame's long side, ~4 % of the short side tall
	let stampTex: WebGLTexture | null = null;
	let rect: [number, number, number, number] = [0, 0, 0, 0];
	if (opts.stamp) {
		const stamp = drawStamp(opts.stamp, Math.min(w, h) * 0.045);
		stampTex = L.texture(stamp);
		const margin = Math.min(w, h) * 0.05;
		const x1 = (w - margin) / w;
		const x0 = x1 - stamp.width / w;
		const y0 = margin / h; // uv y is bottom-up
		rect = [x0, y0, x0 + stamp.width / w, y0 + stamp.height / h];
	}

	const s = opts.stock;
	L.pass(
		'develop',
		null,
		w,
		h,
		[
			['img', img],
			['soft', a.tex],
			['lut', L.lut(s)],
			['stampTex', stampTex ?? img]
		],
		(u) => {
			gl.uniform2f(u('res'), w, h);
			gl.uniform1ui(u('seed'), Math.floor(hash01(opts.seed) * 0xffffffff) >>> 0);
			gl.uniform3fv(u('shadowTint'), s.shadowTint);
			gl.uniform3fv(u('highlightTint'), s.highlightTint);
			gl.uniform1f(u('saturation'), s.saturation);
			// grain size is specified at 12 MP; scale to this frame
			gl.uniform1f(u('grainSize'), Math.max(0.75, s.grain.size * Math.sqrt((w * h) / 12e6)));
			gl.uniform1f(u('grainAmount'), s.grain.amount);
			gl.uniform1f(u('vignette'), s.vignette);
			gl.uniform1f(u('softness'), s.softness);
			gl.uniform1f(u('halation'), s.halation);
			gl.uniform4fv(u('stampRect'), rect);
			gl.uniform3f(u('leak'), opts.leak?.dir[0] ?? 0, opts.leak?.dir[1] ?? 0, opts.leak?.reach ?? 0);
			gl.uniform1f(u('leakStrength'), opts.leak?.strength ?? 0);
		}
	);

	for (const t of [img, a.tex, b.tex, stampTex]) if (t) gl.deleteTexture(t);
	gl.deleteFramebuffer(a.fb);
	gl.deleteFramebuffer(b.fb);
	return L.canvas;
}
