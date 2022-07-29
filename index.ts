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

app.get('/table/past24H', async (req, res) => {
  let now = new Date();
  let past24H = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const data = await pool.query(
    'select * from arbitoor_txns where blocktime between $1 and $2;',
    [past24H.getTime(), now.getTime()]
  );

  res.send(data.rows);
});

app.get('/pools/past24H', async (req, res) => {
  let now = new Date();
  let past24H = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const data = await pool.query(
    'select sum(amount_in) as total_amount_in, sum(amount_out) as total_amount_out, pool_id, dex from arbitoor_txns where blocktime between $1 and $2 group by dex, pool_id;',
    [past24H.getTime(), now.getTime()]
  );

  res.send(data.rows);
});

app.get('/tokens/past24H', async (req, res) => {
  let now = new Date();
  let past24H = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const data = await pool.query(
    'select sum(amount_in) as total_amount_in, sum(amount_out) as total_amount_out, token_in, token_out from arbitoor_txns where blocktime between $1 and $2 group by token_in, token_out;',
    [past24H.getTime(), now.getTime()]
  );

  res.send(data.rows);
});

app.listen(5000, () => console.log('Running'));

// TYPES

// HELPERS
