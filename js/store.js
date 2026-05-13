// ════════════════════════════════════════════════════════
// AGROMOTOR — store.js
// Gestor de Estado Global (Patrón Pub/Sub)
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};

  class AMStore {
    constructor() {
      // Intentar cargar estado desde sessionStorage
      const savedState = sessionStorage.getItem('am_store_state');
      this.state = savedState ? JSON.parse(savedState) : {
        cultivo: 'Soja',
        fecha: new Date().toISOString().split('T')[0],
        coordenadas: '',
        loteId: 'default'
      };
      this.listeners = {};
    }

    // Suscribirse a cambios en una clave específica
    // Ej: AM.store.subscribe('cultivo', (nuevoCultivo) => { ... })
    subscribe(key, callback) {
      if (!this.listeners[key]) {
        this.listeners[key] = [];
      }
      this.listeners[key].push(callback);
      
      // Retornar función para desuscribirse
      return () => {
        this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
      };
    }

    // Actualizar el estado y notificar a los oyentes
    // Ej: AM.store.update({ cultivo: 'Maíz' })
    update(updates) {
      const oldState = { ...this.state };
      let changed = false;

      for (const [key, value] of Object.entries(updates)) {
        if (this.state[key] !== value) {
          this.state[key] = value;
          changed = true;
          // Notificar a los suscritos a esta clave específica
          if (this.listeners[key]) {
            this.listeners[key].forEach(cb => cb(value, oldState[key]));
          }
        }
      }

      if (changed) {
        // Persistir en sessionStorage
        sessionStorage.setItem('am_store_state', JSON.stringify(this.state));
        
        // Notificar a los suscritos globales (escuchan todo cambio)
        if (this.listeners['*']) {
          this.listeners['*'].forEach(cb => cb(this.state, oldState));
        }
      }
    }

    getState() {
      return { ...this.state };
    }
  }

  window.AM.store = new AMStore();
})();
