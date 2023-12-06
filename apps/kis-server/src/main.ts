import axios from 'axios';
import cors from 'cors';
import express from 'express';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.use(express.json());
app.use(cors({ origin: 'http://localhost:4200' }));

// Match all paths starting with "/api-proxy/"
app.all('/api-proxy/*', async (req, res) => {
  const newPath = req.url.split('/').slice(2).join('/');

  const newHeaders = {
    appkey: req.headers.appkey,
    appsecret: req.headers.appsecret,
    tr_id: req.headers.tr_id,
    custtype: req.headers.custtype,
    authorization: req.headers.authorization,
    host: 'openapi.koreainvestment.com:9443',
  };

  console.log('newHeaders', newHeaders);

  try {
    const response = await axios.get(
      `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/${newPath}`,
      { headers: newHeaders },
    );
    res.json(response.data);
  } catch (error) {
    // console.log('error', error);
    res.status(error.response.status || 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});