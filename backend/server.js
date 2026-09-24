const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

if (!process.env.JWT_SECRET) {
  console.error('Manjka JWT_SECRET v .env — strežnik se ne more zagnati.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
require('./db/db');

const authRoutes = require('./routes/auth');
const generateRoutes = require('./routes/generate');
const stripeRoutes = require('./routes/stripe');
const generationRoutes = require('./routes/generations');
const childrenRoutes = require('./routes/children');
const dashboardRoutes = require('./routes/dashboard');
const checkRoutes = require('./routes/checks');

const app = express();
const PORT = process.env.PORT || 4000;
// Več dovoljenih izvorov, ločenih z vejico: produkcija ima drug naslov kot
// razvoj, Vercel pa da vsakemu predogledu svojega. Z enim samim naslovom
// brskalnik blokira zahteve, odjemalec pa vidi le "Strežnik ni dosegljiv".
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

app.use(cors({ origin: FRONTEND_URLS, credentials: true }));
// Stripe webhook potrebuje surovo telo, zato mora biti pred express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sporocilo: 'Snovko backend deluje', cas: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/generations', generationRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/checks', checkRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Pot ne obstaja' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Neveljaven JSON v zahtevi.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Datoteka je prevelika (največ 10 MB).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Prišlo je do napake na strežniku.' });
});

app.listen(PORT, () => {
  console.log(`Snovko backend teče na http://localhost:${PORT}`);
  console.log(`Dovoljeni izvori (CORS): ${FRONTEND_URLS.join(', ')}`);
});
