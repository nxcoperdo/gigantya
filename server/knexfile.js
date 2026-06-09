import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export default {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'restaurante_pedidos_gigantya',
    },
    pool: {
        min: 2,
        max: 10,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seed: {
        directory: './seeds',
    },
};