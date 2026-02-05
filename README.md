# KyamTale Launcher

Fork modificado do [Battly4Hytale](https://github.com/1ly4s0/Battly4Hytale) com foco em privacidade, compatibilidade com versões recentes do client e interface customizada.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-blue) ![Plataforma](https://img.shields.io/badge/Plataforma-Windows-lightgrey) ![Node](https://img.shields.io/badge/Node-20+-green)

![Preview do Launcher](https://i.ibb.co/fVmjDkN6/image.png)

---

## Sobre

O KyamTale Launcher é um fork do Battly Launcher com modificações estruturais. Mantém a proposta central (download, patching e gestão de mods para Hytale), mas com remoção de telemetria, suporte a múltiplos canais de jogo e melhorias no processo de reparo.

---

## Diferencias em Relação ao Projeto Original

### O que foi removido

| Recurso Removido | Descrição |
|------------------|-----------|
| Telemetria Aptabase | O original usa `@aptabase/electron` para analytics. Este fork removeu completamente. |
| Universal Analytics | O original inclui `universal-analytics` como dependência. Removido neste fork. |
| Discord RPC | O original tem integração com Discord Rich Presence (`discord-rpc`, `@kostya-main/discord-rpc`). Este fork não possui. |
| Auto-update | O original verifica e aplica updates automaticamente. Este fork desativou essa funcionalidade. |

O arquivo `src/analytics.js` neste fork contém apenas stubs vazios que não enviam nenhum dado.

### O que foi adicionado ou modificado

| Recurso | Original | Este Fork |
|---------|----------|-----------|
| **Pasta de dados** | `%AppData%/Hytale` | `%AppData%/Kyamtale` |
| **Canais de jogo** | Apenas `latest` | `latest` e `beta` (selecionável na interface) |
| **Idiomas** | 3 (ES, EN, FR) | 8 (EN, ES, PT, FR, DE, RU, JA, ZH) |
| **UUID do jogador** | Gerado a cada sessão | Persistido entre sessões (salvo em config) |
| **Processo de reparo** | Remove pasta diretamente | Retry com fallback, stop de processos, pending delete |
| **Node.js target** | 20+ | 20+ (igual) |

### Arquivos novos ou modificados significativamente

- `src/services/javaManager.js` - Novo. Gerencia download e extração automática de JRE quando necessário.
- `src/main.js` - Refatorado com constantes `GAME_CONFIG`, `VERSION_CONFIG`, `REPAIR_CONFIG`. Suporte a múltiplos canais.
- `src/services/game.js` - Modificado para usar `Kyamtale` como pasta base e suportar seleção de canal.
- `src/analytics.js` - Substituído por stubs vazios (sem envio de dados).
- `src/locales/` - Adicionados: `de.json`, `ja.json`, `ru.json`, `zh.json`.
- `config.json` - Configuração com URLs para canais `latest` e `beta`.

### Dependências removidas

As seguintes dependências presentes no original foram removidas:

```
@aptabase/electron
@kostya-main/discord-rpc
discord-rpc
universal-analytics
```

### Refatoração Recente

| Mudança | Descrição |
|---------|-----------|
| **Modularização do Renderer** | `renderer.js` dividido em módulos (`renderer/`) para melhor manutenibilidade |
| **Unificação de paths** | Configurações agora usam `Kyamtale` com migração automática |
| **API key centralizada** | Chave CurseForge movida para `config.json` |

---
---

## Segurança e Arquitetura

Este fork implementa correções críticas de segurança baseadas nas vulnerabilidades, adotando um modelo de segurança "Sandboxed" moderno.

### Proteções Implementadas

| Vulnerabilidade | Solução Adotada |
|-----------------|-----------------|
| **RCE via XSS** | **HTML Sanitization**: Todo conteúdo remoto (notícias, descrição de mods) é processado pelo `DOMPurify` antes de ser renderizado. Scripts maliciosos são removidos automaticamente. |
| **Node Integration** | **Desativado**: O processo de renderização (interface) não tem mais acesso às APIs do Node.js (`require('fs')`, etc.), impedindo que comprometimentos da UI afetem o sistema. |
| **Context Isolation** | **Ativado**: A comunicação entre UI e Sistema é feita exclusivamente via `ContextBridge` e IPC seguro (`window.api`), sem expor objetos internos do Electron. |
| **Integridade de Mods** | **Verificação de Hash**: Todos os mods baixados da CurseForge têm seu hash SHA1 verificado contra a API oficial. Arquivos corrompidos ou adulterados no trânsito são rejeitados. |

### Arquitetura IPC

A aplicação foi refatorada para usar ES Modules (`import/export`) no frontend, abandonando o padrão antigo inseguro de CommonJS no navegador. 
O acesso a recursos sensíveis (como sistema de arquivos) é restrito ao **Processo Principal**, exposto apenas através de canais permitidos (Allowlist) no `preload.js`.

---

## Requisitos

- Windows 10/11 x64
- Node.js 20 ou superior
- Conexão com a Internet

---

## Instalação (desenvolvimento)

```bash
git clone <repositório>
cd <pasta-do-projeto>
npm install
npm start
```

Scripts:
- `npm start` - Modo desenvolvimento.
- `npm run build` - Gera binário portable em `dist/`.

---

## Estrutura do Projeto

```
src/
├── main.js               # Processo Main (IPC, janelas)
├── renderer.js           # UI principal (~1070 linhas)
├── renderer/             # Módulos da UI
│   ├── utils.js          # sanitizeUsername, shakeElement
│   ├── i18n.js           # Sistema de traduções
│   ├── dialog.js         # Diálogos customizados
│   └── news.js           # Carrossel de notícias
├── analytics.js          # Stubs vazios (sem telemetria)
├── index.html / style.css / splash.html
├── services/
│   ├── game.js           # Orquestração de launch/patch
│   ├── patcher.js        # Patch de client
│   ├── serverPatcher.js  # Patch de JAR servidor
│   ├── javaManager.js    # Download automático de JRE
│   ├── mods.js           # CurseForge API + gestão local
│   ├── news.js           # Feed oficial Hytale
│   ├── updater.js        # Leitura de config remota (update desativado)
│   ├── config.js         # Persistência de configurações
│   └── utils.js          # Helpers de rede/FS
├── locales/              # 8 idiomas
└── assets/, images/
```

---

## Uso

1. Execute `npm start`.
2. Insira seu nome de jogador.
3. Escolha o canal de jogo (Latest ou Beta) e clique em **Jogar**.
4. Para mods, acesse a aba Mods no topo.
5. Configurações (GPU, Java, reparo) estão no ícone de engrenagem.

---

## Solução de Problemas

### Erro ao iniciar o canal Beta

O canal Beta depende de arquivos base que são configurados durante a instalação do canal Latest. Se você tentar iniciar diretamente pelo Beta sem nunca ter executado o Latest, o launcher pode apresentar erros.

**Solução**: Na primeira execução, mantenha o canal em **Latest** e clique em Jogar para completar o setup inicial. Após o jogo abrir pelo menos uma vez, você pode trocar para o canal **Beta** normalmente.

### Outros problemas comuns

- **403 ao baixar patches**: Verifique firewall/antivírus.
- **Jogo não inicia**: Use Reparar Jogo nas configurações ou exclua manualmente `%AppData%/Kyamtale/install`.
- **GPU não detectada**: A detecção usa `wmic`. Selecione manualmente se necessário.

---

## Créditos

- Projeto base: [1ly4s0/Battly4Hytale](https://github.com/1ly4s0/Battly4Hytale)

---

## Licença

ISC.  
Hytale é marca registrada da Hypixel Studios. Este launcher não possui afiliação oficial.
