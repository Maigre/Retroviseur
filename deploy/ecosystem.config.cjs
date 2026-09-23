// pm2 app definition on gaff (/srv/apps/retroviseur). Fork mode, one process.
module.exports = {
	apps: [
		{
			name: 'retroviseur',
			script: 'server.mjs',
			cwd: '/srv/apps/retroviseur',
			env: { PORT: 3001, HOST: '0.0.0.0' },
			max_memory_restart: '200M'
		}
	]
};
