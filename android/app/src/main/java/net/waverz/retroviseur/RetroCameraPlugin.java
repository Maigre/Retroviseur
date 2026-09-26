package net.waverz.retroviseur;

import android.Manifest;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Outline;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import android.util.Size;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.core.resolutionselector.AspectRatioStrategy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;

/**
 * The native camera (docs/ANDROID.md v2, D61). A CameraX preview sits behind the
 * transparent WebView, exactly under the finder's rectangle; the web layer keeps
 * the camera body, the vignette and the blackout on top. A still is written to a
 * private cache file that the web layer reads, develops, seals and then releases
 * at once — unsealed pixels never outlive the shot, and the folder is wiped on
 * load and stop.
 */
@CapacitorPlugin(name = "RetroCamera", permissions = @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"))
public class RetroCameraPlugin extends Plugin {
    /** the frame size asked of the sensor: the closest to this, 4:3 (frames are cropped to 3:2 at 4096 px, D58) */
    private static final Size STILL = new Size(4096, 3072);
    private static final Size LIVE = new Size(1600, 1200);
    /** the body colour the page shows around the finder (--bg) */
    private static final int BACKDROP = 0xFF0B0D0B;

    private PreviewView preview;
    private ImageCapture still;
    private Camera camera;
    private ProcessCameraProvider provider;
    private File dir;
    private float radius = 0;

    @Override
    public void load() {
        dir = new File(getContext().getCacheDir(), "retro-capture");
        wipe();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermission");
            return;
        }
        open(call);
    }

    @PermissionCallback
    private void cameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) open(call);
        else call.reject("denied", "denied");
    }

    private void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensurePreview();
            layout(call);
            preview.setVisibility(View.VISIBLE);
            ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(getContext());
            future.addListener(() -> {
                try {
                    provider = future.get();
                    Preview live = new Preview.Builder().setResolutionSelector(closestTo(LIVE)).build();
                    live.setSurfaceProvider(preview.getSurfaceProvider());
                    // a disposable fires at once: latency over the last bit of processing
                    still = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .setResolutionSelector(closestTo(STILL))
                        .setJpegQuality(95)
                        .build();
                    provider.unbindAll();
                    camera = provider.bindToLifecycle(getActivity(), CameraSelector.DEFAULT_BACK_CAMERA, live, still);
                    JSObject r = new JSObject();
                    r.put("hasFlash", camera.getCameraInfo().hasFlashUnit());
                    if (still.getResolutionInfo() != null) {
                        r.put("width", still.getResolutionInfo().getResolution().getWidth());
                        r.put("height", still.getResolutionInfo().getResolution().getHeight());
                    }
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject("unavailable", "unavailable", e);
                }
            }, ContextCompat.getMainExecutor(getContext()));
        });
    }

    private static ResolutionSelector closestTo(Size size) {
        return new ResolutionSelector.Builder()
            .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
            .setResolutionStrategy(new ResolutionStrategy(size, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
            .build();
    }

    /** Follow the finder when the page lays itself out again (turned stage, resize). */
    @PluginMethod
    public void place(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (preview != null) layout(call);
            call.resolve();
        });
    }

    /** x, y, width, height, radius: the finder in the WebView's physical pixels. */
    private void layout(PluginCall call) {
        WebView web = getBridge().getWebView();
        int w = Math.max(1, Math.round(call.getFloat("width", 1f)));
        int h = Math.max(1, Math.round(call.getFloat("height", 1f)));
        ViewGroup.LayoutParams lp = preview.getLayoutParams();
        lp.width = w;
        lp.height = h;
        preview.setLayoutParams(lp);
        preview.setX(web.getX() + call.getFloat("x", 0f));
        preview.setY(web.getY() + call.getFloat("y", 0f));
        radius = call.getFloat("radius", 0f);
        preview.invalidateOutline();
    }

    private void ensurePreview() {
        if (preview != null) return;
        WebView web = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) web.getParent();
        preview = new PreviewView(getContext());
        // a TextureView, so the rounded clip and the finder's softness apply to it
        preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        preview.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        preview.setOutlineProvider(new ViewOutlineProvider() {
            @Override
            public void getOutline(View v, Outline o) {
                o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius);
            }
        });
        preview.setClipToOutline(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // the web finder's `blur(0.6px) saturate(0.85) brightness(0.95)`
            float d = getContext().getResources().getDisplayMetrics().density;
            ColorMatrix m = new ColorMatrix();
            m.setSaturation(0.85f);
            ColorMatrix dim = new ColorMatrix();
            dim.setScale(0.95f, 0.95f, 0.95f, 1f);
            m.postConcat(dim);
            RenderEffect soft = RenderEffect.createChainEffect(
                RenderEffect.createColorFilterEffect(new ColorMatrixColorFilter(m)),
                RenderEffect.createBlurEffect(0.6f * d, 0.6f * d, Shader.TileMode.CLAMP)
            );
            preview.setRenderEffect(soft);
        }
        parent.addView(preview, 0, new ViewGroup.LayoutParams(1, 1));
        parent.setBackgroundColor(BACKDROP);
        web.setBackgroundColor(Color.TRANSPARENT);
    }

    @PluginMethod
    public void capture(PluginCall call) {
        ImageCapture s = still;
        if (s == null) {
            call.reject("not started");
            return;
        }
        s.setFlashMode(Boolean.TRUE.equals(call.getBoolean("flash", false)) ? ImageCapture.FLASH_MODE_ON : ImageCapture.FLASH_MODE_OFF);
        dir.mkdirs();
        File file = new File(dir, "shot-" + System.nanoTime() + ".jpg");
        ImageCapture.OutputFileOptions out = new ImageCapture.OutputFileOptions.Builder(file).build();
        s.takePicture(out, ContextCompat.getMainExecutor(getContext()), new ImageCapture.OnImageSavedCallback() {
            @Override
            public void onImageSaved(@NonNull ImageCapture.OutputFileResults results) {
                JSObject r = new JSObject();
                r.put("path", file.getAbsolutePath());
                call.resolve(r);
            }

            @Override
            public void onError(@NonNull ImageCaptureException e) {
                file.delete();
                call.reject("capture failed", e);
            }
        });
    }

    /** The web layer has the still: delete the file (only ever one of ours). */
    @PluginMethod
    public void release(PluginCall call) {
        String path = call.getString("path", "");
        File f = new File(path);
        if (dir.equals(f.getParentFile())) f.delete();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (provider != null) provider.unbindAll();
            still = null;
            camera = null;
            if (preview != null) preview.setVisibility(View.GONE);
            wipe();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        wipe();
    }

    private void wipe() {
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) f.delete();
    }
}
