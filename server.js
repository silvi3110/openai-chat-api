require('dotenv').config({ quiet: true });
const { createClient } = require('./src/openai');
const { createApp } = require('./src/app');

const log = (event, details) => {
  if (process.env.NODE_ENV !== 'production') console.log(JSON.stringify({ event, ...details }));
};
const app = createApp({ client: createClient(), log });
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor en puerto ${port}: POST /chat y POST /function`));