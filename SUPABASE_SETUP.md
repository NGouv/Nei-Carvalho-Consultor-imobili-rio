# Configuração do painel de imóveis

## 1. Criar e configurar o projeto Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard) e aguarde o banco ficar disponível.
2. No **SQL Editor**, execute o conteúdo completo de `supabase-schema.sql` em uma instalação nova. Ele cria as tabelas, índices, políticas RLS, bucket privado `property-photos` e publicação Realtime.
   - Se o projeto já usa o esquema anterior deste site, mantenha os dados e execute somente `supabase-migration-primary-image.sql` para adicionar com segurança a seleção da foto principal e a substituição automática ao excluir a capa.
   - Para habilitar a exportação OLX em uma instalação existente, execute também `supabase-migration-olx-cep.sql`; ela adiciona a coluna opcional `properties.cep` sem alterar os registros existentes.
3. Em **Project Settings → API**, copie a Project URL e a chave pública `anon`/publishable. Nunca use `service_role` no site.
4. Copie `.env.example` para `.env` na raiz do projeto e preencha:

   ```dotenv
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
   ```

   O `.env` está ignorado pelo Git. As variáveis `VITE_` entram no bundle público; somente URL e chave pública do Supabase devem ser usadas.

## 2. Criar a conta administradora

1. Em **Authentication → Sign In / Providers**, habilite o provedor **Email**.
2. Em **Authentication → Users**, crie o usuário com o e-mail e a senha que serão usados no painel.
3. Copie o UUID desse usuário.
4. No **SQL Editor**, permita explicitamente esse usuário no painel:

   ```sql
   insert into public.admin_users (user_id)
   values ('UUID-DO-USUARIO-AUTORIZADO');
   ```

   Não há cadastro público de administradores. Só um UUID adicionado por um operador do projeto recebe acesso administrativo.

## 3. Executar e publicar

```powershell
npm install
npm run dev
```

- Site público: `http://127.0.0.1:5173/`
- Painel: `http://127.0.0.1:5173/admin.html`

Para publicar, configure as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de build do provedor estático e execute `npm run build`. Publique o conteúdo de `dist/`; não publique o arquivo `.env`.

## 4. Armazenamento e regras

O SQL cria o bucket privado `property-photos`, limitado a imagens JPEG, PNG, WebP e AVIF de até 8 MB. O painel permite até 20 fotos por imóvel. Políticas de Storage restringem upload, alteração e exclusão a usuários listados em `admin_users`. Visitantes recebem acesso somente a imagens relacionadas a imóveis publicados.

As tabelas `properties`, `property_images` e o bucket aplicam RLS/políticas próprias. A chave pública do navegador não concede acesso administrativo sem uma sessão autenticada e uma linha correspondente em `admin_users`.

Os links de apresentação do YouTube e Instagram Reels são guardados como uma entrada com marcador reservado no array `properties.features`. O site separa essa entrada das características exibidas e valida o domínio antes de gerar a incorporação. Esse recurso não envia arquivos de vídeo nem requer alteração do schema, das políticas ou do Storage.

## 5. Verificação manual

1. Abra `/admin.html` sem sessão: só o formulário de login deve estar disponível.
2. Entre com o usuário autorizado, cadastre um imóvel como rascunho e confirme que ele aparece no painel, mas não no catálogo público.
3. Edite o imóvel, adicione/remova fotos e publique-o; verifique o cartão, filtros, carrossel, detalhes e WhatsApp no site.
4. Despublique e confirme que o imóvel deixa de aparecer no público; exclua-o e verifique a remoção das fotos.
5. Teste os mesmos URLs em uma janela anônima: os dados publicados devem ser públicos, mas a administração deve continuar bloqueada.

O catálogo público recebe atualizações em tempo real quando o Realtime está habilitado no projeto; ao retornar à aba, também consulta novamente os dados.

## 6. Exportação XML para a OLX

1. Execute `supabase-migration-olx-cep.sql` no **SQL Editor** de um projeto existente. Em uma instalação nova, a coluna `cep` já está em `supabase-schema.sql`.
2. No ambiente **Production** do Vercel, configure `PUBLIC_SITE_URL` com a origem HTTPS pública (por exemplo, `https://seu-dominio.com.br`). A função usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, que já são necessárias ao site; também aceita os nomes `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Use exclusivamente a chave `anon`/publishable, nunca `service_role`.
3. Implante o projeto no Vercel. O feed ficará em `/api/integracao/olx.xml`; o painel em `/admin` testa se a URL está publicamente acessível e mostra os imóveis que ainda não podem ser exportados.
4. Preencha o CEP de oito dígitos e uma descrição nos imóveis publicados. Imóveis publicados sem CEP/descrição ou com tipo `Outro` (sem correspondência documentada) são omitidos para não gerar anúncios inválidos. Despublicar ou excluir um imóvel o remove do XML na próxima consulta.
5. Antes da publicação desta versão, execute `supabase-migration-olx-images.sql` no **SQL Editor** do Supabase. A migração apenas adiciona `olx_storage_path` e `olx_ready` a `property_images` e atualiza a política de leitura pública para as fotos de imóveis publicados; não apaga nem altera arquivos ou registros existentes. Registros existentes começam como pendentes.
6. No painel administrativo, use **Preparar fotos pendentes** para processar as fotos dos imóveis publicados que já existiam. Fotos novas são preparadas ao salvar o imóvel, e fotos pendentes também são preparadas ao publicar um imóvel. O XML e `/api/olx-image` só aceitam imagens marcadas como prontas.
7. As fotos originais continuam no bucket privado. Fotos já compatíveis são usadas diretamente; quando necessário, o backend grava um JPEG derivado em um caminho separado, com orientação EXIF aplicada, proporção preservada, dimensão máxima de 2160 × 3840 e alvo de até 4,9 MB. A rota `/api/olx-image` entrega os bytes diretamente com HTTP 200 e não redireciona; a resposta é transmitida em blocos para suportar o limite de 5 MB da OLX sem depender do limite de payload não transmitido da Vercel.
8. A preparação usa Sharp no backend Vercel. Nenhuma chave `service_role` é necessária: a função exige sessão administrativa e opera com o token autenticado e a chave pública. O Storage continua privado, com leitura pública restrita às imagens associadas a imóveis publicados.
9. No painel OLX, confirme a elegibilidade da conta e solicite a ativação da importação XML; compartilhe a URL do feed e siga a validação indicada pela equipe OLX. O manual técnico não informa o canal de habilitação da conta.

O XML segue o [manual oficial da OLX para imóveis](https://developers.olx.com.br/anuncio/xml/real_estate/home.html) e as páginas oficiais de [apartamentos](https://developers.olx.com.br/anuncio/xml/real_estate/sub_apartment.html), [casas](https://developers.olx.com.br/anuncio/xml/real_estate/sub_house.html), [terrenos](https://developers.olx.com.br/anuncio/xml/real_estate/sub_land.html) e [comércio e indústria](https://developers.olx.com.br/anuncio/xml/real_estate/sub_commercial.html). IPTU não é enviado porque o manual define `ValorIPTU` como mensal, mas o dado atual não informa a periodicidade. A área construída também não é enviada como `AreaUtil`, pois os conceitos não são necessariamente equivalentes.
