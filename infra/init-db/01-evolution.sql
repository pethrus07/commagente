-- Cria o banco da Evolution DENTRO do mesmo Postgres do app (setup enxuto p/ VPS pequena).
-- Roda só na 1ª inicialização do Postgres (data dir vazio), via /docker-entrypoint-initdb.d.
-- Assim um único Postgres serve o app (db "zapagente") e a Evolution (db "evolution"),
-- economizando a RAM de um segundo servidor Postgres.
CREATE USER evolution WITH PASSWORD 'evolution';
CREATE DATABASE evolution OWNER evolution;
\connect evolution
GRANT ALL ON SCHEMA public TO evolution;
