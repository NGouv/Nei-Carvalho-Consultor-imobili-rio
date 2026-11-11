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

O endpoint público continua em `/api/integracao/olx.xml`. Ele consulta apenas imóveis publicados no Supabase, gera VRSync e informa as quantidades exportadas e rejeitadas nos cabeçalhos `X-OLX-Exported-Count` e `X-OLX-Rejected-Count`. Não foi adicionada migration nem alterado qualquer dado ou política do Supabase nesta migração.

1. Configure `PUBLIC_SITE_URL` com a origem HTTPS pública no ambiente de execução. O endpoint usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou `SUPABASE_URL` e `SUPABASE_ANON_KEY`); nunca use `service_role`.
2. O painel mostra os motivos de rejeição. Entre os requisitos estão código válido e sem colisões, título de 10 a 90 caracteres sem tags HTML, finalidade e preço válidos, descrição de 50 a 3.000 caracteres, tipo de imóvel VRSync reconhecido, CEP, cidade, bairro, área compatível e ao menos cinco fotos JPG preparadas.
3. O VRSync exige estado em `Location`. Como o schema atual não tem coluna de estado, o feed só o reconhece quando uma UF válida está explicitamente no campo de endereço ou cidade (por exemplo, `Rua Exemplo, 100 - SP`). Não infere o estado pela cidade nem pela região do site; sem UF explícita, rejeita o imóvel.
4. O VRSync exige `LivingArea` para os tipos não-terreno. O cadastro atual só tem `total_area` e `built_area`, que não são tratados como equivalentes à área útil. Portanto, esses imóveis são rejeitados se a área útil não puder ser identificada sem ambiguidade. Terrenos usam `total_area` como `LotArea`. Corrigir essa limitação requer definir uma fonte segura para área útil; esta migração não altera o schema nem inventa valores.
5. Os tipos com mapeamento inequívoco são apartamento (`Residential / Apartment`), casa (`Residential / Home`), casa de condomínio (`Residential / Condo`) e terreno (`Residential / Land`). O tipo genérico `Comercial` e `Outro` não identificam um subtipo oficial e são rejeitados em vez de receberem uma categoria presumida.
6. O feed inclui somente fotos marcadas como prontas; anúncios com menos de cinco são rejeitados. Use **Preparar fotos pendentes** no painel para processar fotos publicadas. As fotos originais continuam privadas e `/api/olx-image` serve diretamente as imagens preparadas em JPEG, conforme as verificações da integração existente.
7. O IPTU não é enviado, pois os registros não informam se o valor é mensal ou anual. A área construída também não é enviada como área útil.
8. Confirme a elegibilidade da conta e solicite a habilitação da integração junto ao Grupo OLX. Depois, use o [validador XML oficial](https://developers.grupozap.com/feeds/xml_validator/) e confira o relatório de integração; XML bem-formado, sozinho, não confirma aceitação dos anúncios.

A estrutura e os campos são baseados na documentação oficial do Grupo OLX: [formatos XML](https://developers.grupozap.com/feeds/xml-formats/), [Header](https://developers.grupozap.com/feeds/vrsync/elements/header.html), [Listing](https://developers.grupozap.com/feeds/vrsync/elements/listing.html), [Details](https://developers.grupozap.com/feeds/vrsync/elements/details.html) e [exemplos VRSync](https://developers.grupozap.com/feeds/vrsync/examples.html).
