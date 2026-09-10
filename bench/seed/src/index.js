const { app } = require('./api/server');
const { logger } = require('./lib/logger');

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info({ port }, 'listening'));
