
-- ============================================================
-- 1. COLUMNAS EN caja_cierres
-- ============================================================
ALTER TABLE pos.caja_cierres
ADD COLUMN fondo_reservado_proximo numeric(10,2) DEFAULT 0 NOT NULL,
ADD COLUMN monto_retirado_dueno    numeric(10,2) DEFAULT 0 NOT NULL;

-- ============================================================
-- 2. TABLA caja_arqueos (cortes parciales)
-- ============================================================
CREATE TABLE pos.caja_arqueos (
    id             SERIAL        PRIMARY KEY,
    caja_id        integer       NOT NULL REFERENCES pos.caja_aperturas(id) ON DELETE CASCADE,
    usuario_id     integer       NOT NULL REFERENCES pos.usuarios(id),
    monto_esperado numeric(10,2) NOT NULL,
    monto_contado  numeric(10,2) NOT NULL,
    diferencia     numeric(10,2) GENERATED ALWAYS AS (monto_contado - monto_esperado) STORED,
    observaciones  text,
    created_at     timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX idx_caja_arqueos_caja_id ON pos.caja_arqueos(caja_id);
CREATE INDEX idx_caja_arqueos_fecha   ON pos.caja_arqueos(created_at DESC);

-- ============================================================
-- OPCIONAL pero recomendado: validar que fondo + retiro
-- no supere el monto final real al cerrar caja
-- ============================================================
ALTER TABLE pos.caja_cierres
ADD CONSTRAINT chk_distribucion_cierre
CHECK (fondo_reservado_proximo + monto_retirado_dueno <= monto_final_real);