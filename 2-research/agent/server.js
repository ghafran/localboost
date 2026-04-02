import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateCompany } from './src/evaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'agency-ai-employee' });
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const { companyName, zipCode } = req.body ?? {};

    if (!companyName || !zipCode) {
      return res.status(400).json({
        error: 'companyName and zipCode are required.'
      });
    }

    const result = await evaluateCompany({ companyName, zipCode });
    return res.json(result);
  } catch (error) {
    console.error('Evaluation failed:', error);
    return res.status(500).json({
      error: error?.message || 'Unexpected server error.'
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Agency AI Employee running on http://localhost:${port}`);
});
