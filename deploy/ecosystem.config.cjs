// pm2 app definition on gaff. /srv/apps/retroviseur is a git checkout of this
// repo; deploy/update.sh builds into build/ and publishes to dist/.
module.exports = {
	apps: [
		{
			name: 'retroviseur',
			script: 'deploy/server.mjs',
			cwd: '/srv/apps/retroviseur',
			env: {
				PORT: 3001,
				HOST: '0.0.0.0',
				ROOT: '/srv/apps/retroviseur/dist',
				// the lab's rolls: outside the checkout, never touched by deploys (docs/LAB.md)
				LAB_DIR: '/srv/apps/retroviseur-data/lab',
				// kxkm-prod and holden each append to X-Forwarded-For
				LAB_PROXY_HOPS: 2
			},
			max_memory_restart: '200M'
		}
	]
};
