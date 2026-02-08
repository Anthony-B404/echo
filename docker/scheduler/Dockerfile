# Scheduler container with supercronic for cron jobs
ARG BACKEND_IMAGE=ghcr.io/anthonybette/dh-echo/backend:latest
FROM ${BACKEND_IMAGE}

# Install supercronic (lightweight cron for containers)
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=cd48d45c4b10f3f0bfdd3a57d054cd05ac96812b \
    SUPERCRONIC=supercronic-linux-amd64

USER root

RUN apk add --no-cache curl \
    && curl -fsSLO "$SUPERCRONIC_URL" \
    && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
    && chmod +x "$SUPERCRONIC" \
    && mv "$SUPERCRONIC" /usr/local/bin/supercronic \
    && apk del curl

# Copy crontab
COPY crontab /etc/crontab

# Run supercronic with the crontab
# Note: USER is NOT set here because the inherited entrypoint.sh
# runs as root (chown storage dirs) then drops to adonisjs via su-exec
CMD ["supercronic", "/etc/crontab"]
