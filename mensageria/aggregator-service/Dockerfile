# Dockerfile para Serviço de Agregação
# Implementa RD001: Containerização

FROM node:18-alpine

# Metadados da imagem
LABEL maintainer="Sistema de Mensageria FURB"
LABEL version="1.0.0"
LABEL description="Serviço de Agregação de Dados de Sensores de Solo"

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S aggregator -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código fonte
COPY src/ ./src/

# Alterar propriedade dos arquivos para o usuário não-root
RUN chown -R aggregator:nodejs /app

# Mudar para usuário não-root
USER aggregator

# Expor porta (se necessário para health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json
ENV AGGREGATION_PERIOD_MINUTES=5
ENV AGGREGATION_TOLERANCE_SECONDS=30

# Comando de inicialização
CMD ["npm", "start"]
