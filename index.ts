import express from 'express';
import cors from 'cors';

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: 'postgres://ubuntu:root@localhost:5432/ubuntu',
});

/** EXPRESS SERVER */

const app = express();

app.use(cors());

app.get('/', (req, res) => res.send('Hello'));

app.get('/table', async (req, res) => {
  const data = await pool.query('SELECT * FROM arbitoor_txns');

  let result = `<table>`;

  for (const row of data.rows) {
    result.concat(`<tr>
      <td> ${row.receipt_id} </td>
      <td> ${row.block_height}  </td>
      <td> ${row.blocktime} </td>
      <td> ${row.dex} </td>
      <td> ${row.sender} </td>
      <td> ${row.success} </td>
      <td> ${row.amount_in} </td>
      <td> ${row.amount_out} </td>
      <td> ${row.pool_id} </td>
      <td> ${row.token_in} </td>
      <td> ${row.token_out} </td>
    </tr>`);
  }

  result += `<table>`;

  res.send(result);
});

app.listen(5000, () => console.log('Running'));

// TYPES

// HELPERS
