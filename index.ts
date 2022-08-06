import express from 'express';
import cors from 'cors';
import Big from 'big.js';
// @ts-ignore
import localData from './data/data.json';
import { MainnetRpc } from 'near-workspaces';
import { TokenInfo } from '@tonic-foundation/token-list';
import { InMemoryProvider } from '@arbitoor/arbitoor-core';

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: 'postgres://ubuntu:root@localhost:5432/ubuntu',
});

const tokenList = localData.tokensMap as Array<TokenInfo>;

const tokensMap = tokenList.reduce((map, item) => {
  map.set(item.address, item);
  return map;
}, new Map<string, TokenInfo>());

const provider = new InMemoryProvider(MainnetRpc, tokensMap);

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
    'select sum(amount_in) as total_amount_in, token_in, sum(amount_out) as total_amount_out, token_out, pool_id, dex from arbitoor_txns where blocktime between $1 and $2 group by dex, pool_id, token_in, token_out;',
    [past24H.getTime(), now.getTime()]
  );

  res.send(data.rows);
});

// Fetches 24H token volume
app.get('/tokens-volume/past-24H', async (req, res) => {
  let now = new Date();
  let past24H = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const tokensInData = await pool.query(
    'select sum(amount_in) as total_amount, token_in from arbitoor_txns where blocktime between $1 and $2 group by token_in;',
    [past24H.getTime(), now.getTime()]
  );

  const tokensOutData = await pool.query(
    'select sum(amount_out) as total_amount, token_out from arbitoor_txns where blocktime between $1 and $2 group by token_out;',
    [past24H.getTime(), now.getTime()]
  );

  const tokensResult = tokensInData.rows.concat(tokensOutData.rows);

  const tokensOut = new Map<string, string>();

  for (const row of tokensResult) {
    const tokenAdd = row.token_in ?? row.token_out;
    let tokenAmount = new Big(row.total_amount.toString());
    if (tokensOut.get(tokenAdd)) {
      tokenAmount.add(new Big(tokensOut.get(tokenAdd) ?? '0'));
    }
    tokensOut.set(tokenAdd, tokenAmount.toString());
  }

  // console.log(tokensOut);

  res.send(Array.from(tokensOut));
});

// Fetches token volume from beggining
app.get('/tokens-volume', async (req, res) => {
  const tokensInData = await pool.query(
    'select sum(amount_in) as total_amount, token_in from arbitoor_txns group by token_in;'
  );

  const tokensOutData = await pool.query(
    'select sum(amount_out) as total_amount, token_out from arbitoor_txns group by token_out;'
  );

  const tokensResult = tokensInData.rows.concat(tokensOutData.rows);

  const tokensOut = new Map<string, string>();

  for (const row of tokensResult) {
    const tokenAdd = row.token_in ?? row.token_out;
    let tokenAmount = new Big(row.total_amount.toString());
    if (tokensOut.get(tokenAdd)) {
      tokenAmount.add(new Big(tokensOut.get(tokenAdd) ?? '0'));
    }
    tokensOut.set(tokenAdd, tokenAmount.toString());
  }

  // console.log(tokensOut);

  res.send(Array.from(tokensOut));
});

// Fetches dexes volume for past 24H
app.get('/dexes-volume/past-24H', async (req, res) => {
  let now = new Date();
  let past24H = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const result = await pool.query(
    'select sum(amount_out) as amount_out, sum(amount_in) as amount_in, token_in, token_out, dex from arbitoor_txns where blocktime between $1 and $2  group by dex, token_in, token_out;',
    [past24H.getTime(), now.getTime()]
  );

  const dexesOut = new Map<string, string>();

  for (const row of result.rows) {
    const tokenIn = row.token_in;
    const tokenOut = row.token_out;
    const amountIn = row.amount_in;
    const amountOut = row.amount_out;
    const dex = row.dex;

    let tokenInDecimals =
      tokensMap.get(tokenIn)?.decimals ??
      (await provider.getTokenMetadata(tokenIn))?.decimals ??
      1;
    let tokenOutDecimals =
      tokensMap.get(tokenOut)?.decimals ??
      (await provider.getTokenMetadata(tokenOut))?.decimals ??
      1;

    let totalTokensAmountIn = new Big(amountIn).mul(
      new Big('10').pow(-tokenInDecimals)
    );
    let totalTokensAmountOut = new Big(amountOut).mul(
      new Big('10').pow(-tokenOutDecimals)
    );

    let totalTokensAmount = totalTokensAmountIn.add(totalTokensAmountOut);

    if (dexesOut.get(dex)) {
      totalTokensAmount.add(new Big(dexesOut.get(dex) ?? '0'));
    }

    dexesOut.set(dex, totalTokensAmount.toString());
  }

  // console.log(dexesOut);

  res.send(Array.from(dexesOut));
});

// Fetches dexes volume from beg
app.get('/dexes-volume', async (req, res) => {
  const result = await pool.query(
    'select sum(amount_out) as amount_out, sum(amount_in) as amount_in, token_in, token_out, dex from arbitoor_txns group by dex, token_in, token_out;'
  );

  const dexesOut = new Map<string, string>();

  for (const row of result.rows) {
    const tokenIn = row.token_in;
    const tokenOut = row.token_out;
    const amountIn = row.amount_in;
    const amountOut = row.amount_out;
    const dex = row.dex;

    let tokenInDecimals =
      tokensMap.get(tokenIn)?.decimals ??
      (await provider.getTokenMetadata(tokenIn))?.decimals ??
      1;
    let tokenOutDecimals =
      tokensMap.get(tokenOut)?.decimals ??
      (await provider.getTokenMetadata(tokenOut))?.decimals ??
      1;

    let totalTokensAmountIn = new Big(amountIn).mul(
      new Big('10').pow(-tokenInDecimals)
    );
    let totalTokensAmountOut = new Big(amountOut).mul(
      new Big('10').pow(-tokenOutDecimals)
    );

    let totalTokensAmount = totalTokensAmountIn.add(totalTokensAmountOut);

    if (dexesOut.get(dex)) {
      totalTokensAmount.add(new Big(dexesOut.get(dex) ?? '0'));
    }

    dexesOut.set(dex, totalTokensAmount.toString());
  }

  // console.log(dexesOut);

  res.send(Array.from(dexesOut));
});

app.listen(5000, () => console.log('Running'));

// TYPES

// HELPERS
