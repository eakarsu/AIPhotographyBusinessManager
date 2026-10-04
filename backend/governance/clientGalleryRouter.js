const express = require('express');
const pool = require('../db');
const { createClientGalleryRouter } = require('./localGalleryRouter');

const db = {
  query: async (sql, params) => (await pool.query(sql, params)).rows,
  transaction: async work => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(async (sql, params) => (await client.query(sql, params)).rows);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
};

module.exports = createClientGalleryRouter({ express, db });
