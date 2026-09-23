// pm2 app definition on gaff. /srv/apps/retroviseur is a git checkout of this
// repo; deploy/update.sh builds into build/ and publishes to dist/.
module.exports = {
	apps: [
		{
			name: 'retroviseur',
			script: 'deploy/server.mjs',
			cwd: '/srv/apps/retroviseur',
			env: { PORT: 3001, HOST: '0.0.0.0', ROOT: '/srv/apps/retroviseur/dist' },
			max_memory_restart: '200M'
		}
	]
};
