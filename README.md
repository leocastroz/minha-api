# API Drogaria Popular

API Node.js para integração com o SQL Server do Inovafarma. A API interna roda em loopback na porta 4000. Em produção, o processo na porta 4001 atende o Cloudflare Tunnel e valida as chaves Bearer de catálogo, integração e administração.

## Desenvolver no computador pessoal

Use Git e Node.js 24.

```powershell
git clone https://github.com/leocastroz/minha-api.git
cd minha-api
npm ci
Copy-Item .env.example .env
```

Preencha o `.env` com os dados de um SQL Server de desenvolvimento ou homologação. Suas credenciais e chaves ficam fora do Git. O banco de desenvolvimento precisa ter as tabelas da aplicação que as rotas consultam. Para iniciar com recarga automática:

```powershell
npm run dev
```

O Swagger interno fica em `http://127.0.0.1:4000/docs/`. Para cada melhoria, crie uma branch, faça o commit e revise as mudanças em um pull request antes de integrar à `main`.

## Implantar no Windows

Mantenha um clone separado para implantação. Depois que uma melhoria estiver na `main`, atualize esse clone com `git pull --ff-only`, instale as versões do lockfile com `npm ci --omit=dev` e execute o script local de implantação do WinSW como administrador. O serviço MinhaApi em produção usa uma cópia implantada do código. Atualizar o clone Git por si só não recarrega esse processo.

Na máquina de produção, o arquivo de ambiente e as chaves Bearer ficam na configuração local do serviço. O serviço `MinhaApi` executa `node src/public.js` com `MINHA_API_TOKEN_FILE` apontando para a chave do catálogo. As chaves de integração e administração são lidas dos arquivos `integracao.key` e `administracao.key` no mesmo diretório. Essas chaves ficam fora do clone.

Após publicar, confira se o catálogo sem chave devolve HTTP 401, se a consulta autorizada devolve HTTP 200 e se as rotas administrativas exigem a credencial correspondente.
