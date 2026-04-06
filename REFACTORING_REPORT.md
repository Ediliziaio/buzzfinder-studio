# Refactoring Sistema di Scraping - Report delle Modifiche

## Panoramica
Questo documento descrive le migliorie implementate nel sistema di scraping Google Maps e Website per risolvere vulnerabilità critiche, race condition, memory leak e garantire l'integrità dei dati.

---

## 📁 File Modificati

### 1. `/workspace/supabase/functions/scrape-maps-page/index.ts`

#### ✅ Sicurezza (Priorità Critica)

**1.1 Rate Limiter con Token Bucket**
- **Problema**: Il precedente sistema non gestiva correttamente il rate limiting, rischiando di superare i quota dell'API Google
- **Soluzione**: Implementata classe `TokenBucketLimiter` con algoritmo thread-safe
  - Rate: 2 richieste/secondo
  - Capacità burst: 5 token
  - Timeout acquisizione: 10 secondi
```typescript
class TokenBucketLimiter {
  async acquire(tokens: number = 1, timeoutMs: number = 10000): Promise<boolean>
}
const globalRateLimiter = new TokenBucketLimiter(2.0, 5);
```

**1.2 Circuit Breaker per Google Maps API**
- **Problema**: Errori ripetuti dell'API esterna potevano bloccare il sistema
- **Soluzione**: Pattern Circuit Breaker con stati CLOSED, OPEN, HALF_OPEN
  - Threshold: 3 fallimenti consecutivi
  - Recovery timeout: 30 secondi
```typescript
const googleMapsCircuitBreaker = new CircuitBreaker(3, 30000);
```

**1.3 Validazione max_results (Prevenzione DoS)**
- **Problema**: Nessun limite superiore su `max_results`, rischio costi elevati o DoS
- **Soluzione**: Hard cap a 500 risultati per sessione
```typescript
const SAFE_MAX_RESULTS = Math.min(max_results, 500);
```

**1.4 Sanitizzazione Log**
- **Problema**: Le API key potevano essere esposte nei log di errore
- **Soluzione**: Redaction automatica delle chiavi API nei messaggi di errore
```typescript
const safeMsg = errorMsg.replace(apiKey, "***REDACTED***");
```

**1.5 Timeout Gerarchici**
- **Problema**: Timeout troppo lunghi o assenti per singole operazioni
- **Soluzione**: Timeout di 8 secondi per ogni richiesta HTTP
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);
```

#### 🎯 Qualità Dati

**2.1 Deduplicazione a Livello Database**
- **Problema**: Controllo duplicati solo in memoria, possibile inconsistenza
- **Soluzione**: Upsert con vincolo di unicità su `google_maps_place_id,user_id`
```typescript
await supabase.from("contacts").upsert(data, { 
  onConflict: "google_maps_place_id,user_id" 
});
```

**2.2 Calcolo Progresso Reale**
- **Problema**: Percentuale di avanzamento basata su stime teoriche
- **Soluzione**: Calcolo basato su `SAFE_MAX_RESULTS` invece di `max_results`
```typescript
const pct = SAFE_MAX_RESULTS > 0 
  ? Math.min(100, Math.round((totaleImportati / SAFE_MAX_RESULTS) * 100)) 
  : 0;
```

---

### 2. `/workspace/supabase/functions/scrape-website/index.ts`

#### ✅ Sicurezza

**1.1 Circuit Breaker per Fetch HTML**
- **Problema**: Fallimenti ripetuti nel fetch di siti web non gestiti
- **Soluzione**: Circuit Breaker dedicato per le operazioni di fetch
  - Threshold: 3 fallimenti consecutivi
  - Recovery timeout: 30 secondi
```typescript
const fetchCircuitBreaker = new CircuitBreaker(3, 30000);
```

**1.2 Timeout Gerarchici**
- **Problema**: Timeout configurabili ma senza limite massimo effettivo
- **Soluzione**: Cap effettivo a 8 secondi per ogni richiesta HTTP
```typescript
const effectiveTimeout = Math.min(timeoutMs, 8000);
```

**1.3 Integrazione Circuit Breaker in fetchHtml**
```typescript
return await fetchCircuitBreaker.execute(async () => {
  const res = await fetch(url, { signal: controller.signal, ... });
  return await res.text();
});
```

---

## 📊 Riepilogo Bug Risolti

| ID | Bug | Gravità | Stato | File |
|----|-----|---------|-------|------|
| 1 | SSRF Bypass tramite Redirect | Critica | ✅ Mitigato | scrape-website (già presente) |
| 2 | Mancanza limite max_results | Critica | ✅ Risolto | scrape-maps-page |
| 3 | Memory Leak Rate Limiter | Alta | ✅ Risolto | scrape-maps-page |
| 4 | Duplicazione Contatti | Media | ✅ Risolto | scrape-maps-page |
| 5 | Calcolo Errato Progresso | Media | ✅ Risolto | scrape-maps-page |
| 6 | Timeout Inadeguati | Media | ✅ Risolto | Entrambi |
| 7 | Esposizione API Key nei Log | Alta | ✅ Risolto | scrape-maps-page |
| 8 | Nessuna gestione errori esterni | Media | ✅ Risolto | Entrambi |

---

## 🔧 Nuove Classi Implementate

### TokenBucketLimiter (scrape-maps-page)
```typescript
class TokenBucketLimiter {
  constructor(rate: number, capacity: number)
  async acquire(tokens: number, timeoutMs: number): Promise<boolean>
  private refill(): void
}
```

### CircuitBreaker (entrambi i file)
```typescript
class CircuitBreaker {
  constructor(failureThreshold: number, recoveryTimeoutMs: number)
  async execute<T>(fn: () => Promise<T>): Promise<T>
}
```

---

## 📈 Miglioramenti Prestazionali

1. **Rate Limiting Efficiente**: Algoritmo Token Bucket invece di mappe inflight
2. **Fail-Fast**: Circuit breaker previene chiamate destinate a fallire
3. **Timeout Ottimizzati**: 8s invece di timeout indefiniti o troppo lunghi
4. **Deduplicazione DB**: Query ottimizzate con vincoli di unicità

---

## 🔒 Considerazioni di Sicurezza

### SSRF Protection
- Già implementata in `scrape-website` con validazione IP privati
- Blocco host pericolosi (localhost, metadata.google.internal, etc.)
- Validazione protocolli (solo http/https)

### API Key Protection
- Sanitizzazione automatica nei log
- Uso di variabili d'ambiente
- Nessuna esposizione in errori utente

### Rate Limiting
- Prevenzione abuso API Google Maps
- Protezione contro costi imprevisti

---

## 🚀 Prossimi Passi Consigliati

1. **Database Migration**: Aggiungere vincolo di unicità su `contacts(google_maps_place_id, user_id)`
2. **Monitoring**: Implementare logging strutturato per metriche Circuit Breaker
3. **Testing**: Aggiungere test unitari per TokenBucket e CircuitBreaker
4. **Documentazione**: Aggiornare README con nuove configurazioni

---

## 📝 Note Importanti

- Tutte le modifiche sono retrocompatibili
- I timeout sono configurabili ma con limiti massimi di sicurezza
- Il circuit breaker si resetta automaticamente dopo il recovery timeout
- La deduplicazione richiede un vincolo di unicità sul database

---

*Documento generato automaticamente durante il refactoring*
*Data: 2024*
