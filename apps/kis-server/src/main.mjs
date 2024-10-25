import axios from 'axios';
import cors from 'cors';
import express from 'express';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.use(express.json());
// app.use(cors({ origin: 'http://localhost:4200' }));
app.use(cors());

app.get('/health', (req, res) => {
  res.send('health ok !!!');
});

const target = 'openapi.koreainvestment.com:9443';

// Match all paths starting with "/api-proxy/"
app.all('/api-proxy/*', async (req, res) => {
  const authReq = req.url.endsWith('tokenP');
  const newPath = req.url.split('/').slice(2).join('/');

  const newHeaders = authReq
    ? { host: target }
    : {
      appkey: req.headers.appkey,
      appsecret: req.headers.appsecret,
      tr_id: req.headers.tr_id,
      custtype: req.headers.custtype,
      authorization: req.headers.authorization,
      host: target,
    };

  // console.log('newHeaders', newHeaders);
  try {
    let response;
    const method = req.method.toLowerCase();
    const url = `https://${target}/${authReq ? newPath : `uapi/domestic-stock/v1/${newPath}`}`;
    if (method === 'get') {
      response = await axios.get(
        url,
        { headers: newHeaders },
      );
      res.json(response.data);
    } else if (method === 'post') {
      response = await axios.post(
        url,
        req.body,
        { headers: newHeaders },
      );
      res.json(response.data);
    } else {
      res.status(500).json({ error: `Method ${req.method} not supported` });
    }
  } catch (error) {
    res.status(error?.response?.status || 500).json(error?.response?.data || { error: error?.message || 'Unknown server error' });
  }
});

app.listen(port, () => {
  console.log(`[${new Date()}] Proxy server listening at http://localhost:${port}`);
});