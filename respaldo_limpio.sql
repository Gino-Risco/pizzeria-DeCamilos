--
-- PostgreSQL database dump
--

\restrict HudmYzef6vYBbcSEl0eHrWX8ZNh75QMyDSNM4UiKSPm00SHwWIDbRj0TCtOQxeg

-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

-- Started on 2026-04-27 14:18:22

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 26818)
-- Name: inventario; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA inventario;


--
-- TOC entry 6 (class 2615 OID 26817)
-- Name: pos; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pos;


--
-- TOC entry 920 (class 1247 OID 26878)
-- Name: caja_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.caja_estado AS ENUM (
    'abierta',
    'cerrada'
);


--
-- TOC entry 923 (class 1247 OID 26884)
-- Name: caja_mov_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.caja_mov_tipo AS ENUM (
    'apertura',
    'venta',
    'retiro',
    'gasto',
    'cierre',
    'ingreso'
);


--
-- TOC entry 911 (class 1247 OID 26838)
-- Name: item_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.item_tipo AS ENUM (
    'entrada',
    'fondo',
    'bebida',
    'postre',
    'snack',
    'insumo',
    'preparado',
    'empacado'
);


--
-- TOC entry 926 (class 1247 OID 26896)
-- Name: kardex_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kardex_tipo AS ENUM (
    'compra',
    'venta',
    'salida_cocina',
    'ajuste',
    'merma',
    'reversion',
    'ajuste_entrada',
    'ajuste_salida'
);


--
-- TOC entry 908 (class 1247 OID 26828)
-- Name: mesa_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mesa_estado AS ENUM (
    'libre',
    'ocupada',
    'reservada',
    'mantenimiento'
);


--
-- TOC entry 914 (class 1247 OID 26852)
-- Name: orden_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orden_estado AS ENUM (
    'abierta',
    'enviada_cocina',
    'preparando',
    'lista',
    'cobrada',
    'cancelada'
);


--
-- TOC entry 917 (class 1247 OID 26866)
-- Name: pago_metodo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pago_metodo AS ENUM (
    'efectivo',
    'tarjeta',
    'yape',
    'plin',
    'mixto'
);


--
-- TOC entry 1010 (class 1247 OID 27522)
-- Name: pedido_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pedido_tipo AS ENUM (
    'salon',
    'llevar',
    'delivery'
);


--
-- TOC entry 905 (class 1247 OID 26820)
-- Name: rol_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_tipo AS ENUM (
    'administrador',
    'cajero',
    'mesero'
);


--
-- TOC entry 929 (class 1247 OID 26910)
-- Name: ticket_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_tipo AS ENUM (
    'pedido_cocina',
    'venta_cliente'
);


--
-- TOC entry 932 (class 1247 OID 26916)
-- Name: turno_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.turno_tipo AS ENUM (
    'manana',
    'tarde',
    'noche'
);


--
-- TOC entry 289 (class 1255 OID 27415)
-- Name: fn_kardex_movimiento(integer, public.kardex_tipo, numeric, character varying, integer, character varying, integer, numeric, integer); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.fn_kardex_movimiento(p_producto_id integer, p_tipo public.kardex_tipo, p_cantidad numeric, p_referencia_tipo character varying, p_referencia_id integer, p_referencia character varying, p_usuario_id integer, p_costo_unitario numeric DEFAULT NULL::numeric, p_reversion_de integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_stock_actual DECIMAL(10,3); 
    v_stock_nuevo DECIMAL(10,3); 
    v_controla_stock BOOLEAN; 
    v_permite_negativo BOOLEAN; 
    v_stock_minimo DECIMAL(10,3); 
    v_nombre VARCHAR(150); 
    v_kardex_id INT;
    
    -- Variables con 4 decimales para precisión financiera real
    v_costo_prom_actual DECIMAL(14,4);
    v_nuevo_costo_prom DECIMAL(14,4);
    v_costo_unitario_mov DECIMAL(14,4);
    v_valor_movimiento DECIMAL(14,4);
    v_valor_saldo DECIMAL(14,4);
    
    v_reversion_count INT;
BEGIN
    -- 1. Validación estricta: Rechazar números negativos o cero
    IF p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad del movimiento debe ser mayor a 0 (Recibido: % para el producto ID %)', p_cantidad, p_producto_id;
    END IF;

    -- 2. Control de concurrencia: Bloqueamos la fila
    SELECT stock_actual, costo_promedio, control_stock, permite_stock_negativo, stock_minimo, nombre 
    INTO v_stock_actual, v_costo_prom_actual, v_controla_stock, v_permite_negativo, v_stock_minimo, v_nombre 
    FROM inventario.productos WHERE id = p_producto_id FOR UPDATE;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto % no encontrado', p_producto_id; END IF;

    v_costo_prom_actual := COALESCE(v_costo_prom_actual, 0);

    -- 3. Prevención de Doble Reversión
    IF p_reversion_de IS NOT NULL THEN
        SELECT COUNT(*) INTO v_reversion_count FROM inventario.kardex WHERE reversion_de = p_reversion_de;
        IF v_reversion_count > 0 THEN
            RAISE EXCEPTION 'ALERTA: El movimiento original % ya ha sido revertido previamente.', p_reversion_de;
        END IF;
    END IF;

    -- 4. Matemáticas de Stock y Costos
    IF p_tipo IN ('compra', 'ajuste_entrada', 'reversion') THEN 
        v_stock_nuevo := v_stock_actual + p_cantidad;
        v_costo_unitario_mov := COALESCE(p_costo_unitario, v_costo_prom_actual);
        
        IF v_stock_nuevo > 0 THEN
            v_nuevo_costo_prom := ((v_stock_actual * v_costo_prom_actual) + (p_cantidad * v_costo_unitario_mov)) / v_stock_nuevo;
        ELSE
            v_nuevo_costo_prom := v_costo_prom_actual;
        END IF;
        v_valor_movimiento := p_cantidad * v_costo_unitario_mov;
        
    ELSE 
        v_stock_nuevo := v_stock_actual - p_cantidad;
        
        IF v_stock_nuevo < 0 AND v_permite_negativo = FALSE AND v_controla_stock = TRUE THEN 
            RAISE EXCEPTION 'Stock insuficiente para "%". Stock actual: %, Intento de salida: %', v_nombre, v_stock_actual, p_cantidad; 
        END IF;
        
        v_costo_unitario_mov := v_costo_prom_actual;
        v_nuevo_costo_prom := v_costo_prom_actual; 
        v_valor_movimiento := -(p_cantidad * v_costo_unitario_mov);
    END IF;

    v_valor_saldo := v_stock_nuevo * v_nuevo_costo_prom;

    -- 5. Registrar en el Kardex
    INSERT INTO inventario.kardex (
        producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, 
        costo_unitario, costo_promedio, valor_movimiento, valor_saldo, 
        referencia_tipo, referencia_id, referencia, usuario_id, reversion_de
    ) VALUES (
        p_producto_id, p_tipo, p_cantidad, v_stock_actual, v_stock_nuevo, 
        v_costo_unitario_mov, v_nuevo_costo_prom, v_valor_movimiento, v_valor_saldo, 
        p_referencia_tipo, p_referencia_id, p_referencia, p_usuario_id, p_reversion_de
    ) RETURNING id INTO v_kardex_id;

    -- 6. Actualizar el Producto
    IF v_controla_stock = TRUE THEN 
        UPDATE inventario.productos 
        SET stock_actual = v_stock_nuevo, costo_promedio = v_nuevo_costo_prom 
        WHERE id = p_producto_id; 
    ELSE
        UPDATE inventario.productos SET costo_promedio = v_nuevo_costo_prom WHERE id = p_producto_id;
    END IF;

    -- 7. Alertas de Stock
    IF v_controla_stock = TRUE THEN
        IF v_stock_nuevo < 0 THEN 
            INSERT INTO inventario.alertas_stock (producto_id, tipo_alerta, stock_en_alerta, stock_minimo, referencia_tipo, referencia_id, usuario_id) VALUES (p_producto_id, 'stock_negativo', v_stock_nuevo, v_stock_minimo, p_referencia_tipo, p_referencia_id, p_usuario_id);
        ELSIF v_stock_nuevo <= v_stock_minimo AND v_stock_minimo > 0 THEN 
            INSERT INTO inventario.alertas_stock (producto_id, tipo_alerta, stock_en_alerta, stock_minimo, referencia_tipo, referencia_id, usuario_id) VALUES (p_producto_id, 'stock_bajo', v_stock_nuevo, v_stock_minimo, p_referencia_tipo, p_referencia_id, p_usuario_id);
        END IF;
    END IF;

    RETURN v_kardex_id;
END;
$$;


--
-- TOC entry 287 (class 1255 OID 27416)
-- Name: fn_revertir_kardex(integer, integer, character varying); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.fn_revertir_kardex(p_kardex_id integer, p_usuario_id integer, p_motivo character varying DEFAULT 'Reversión manual'::character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_k         inventario.kardex%ROWTYPE;
    v_tipo_rev  kardex_tipo;
BEGIN
    SELECT * INTO v_k FROM inventario.kardex WHERE id = p_kardex_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento de kardex % no encontrado', p_kardex_id;
    END IF;
    IF v_k.reversion_de IS NOT NULL THEN
        RAISE EXCEPTION 'El movimiento % ya es una reversión, no se puede revertir de nuevo', p_kardex_id;
    END IF;

    -- El movimiento de reversión siempre es tipo 'reversion' (suma al stock)
    RETURN inventario.fn_kardex_movimiento(
        v_k.producto_id,
        'reversion',
        v_k.cantidad,
        'reversion',
        p_kardex_id,
        p_motivo,
        p_usuario_id,
        NULL,
        p_kardex_id  -- reversion_de
    );
END;
$$;


--
-- TOC entry 288 (class 1255 OID 27419)
-- Name: trg_compra_detalle_kardex(); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.trg_compra_detalle_kardex() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_usuario_id INT;
    v_nombre     VARCHAR(150);
BEGIN
    SELECT usuario_id INTO v_usuario_id FROM inventario.compras WHERE id = NEW.compra_id;
    SELECT nombre INTO v_nombre FROM inventario.productos WHERE id = NEW.producto_id;

    PERFORM inventario.fn_kardex_movimiento(
        NEW.producto_id,
        'compra',
        NEW.cantidad,
        'compra',
        NEW.compra_id,
        'Compra #' || NEW.compra_id || ' - ' || v_nombre,
        v_usuario_id,
        NEW.costo_unitario
    );

    RETURN NEW;
END;
$$;


--
-- TOC entry 272 (class 1255 OID 27022)
-- Name: trg_proteger_stock(); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.trg_proteger_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Solo validar si cambia stock_actual
    IF NEW.stock_actual <> OLD.stock_actual THEN
        -- Si el nuevo stock es negativo y el producto no lo permite: bloquear
        IF NEW.stock_actual < 0 AND NEW.permite_stock_negativo = FALSE AND NEW.control_stock = TRUE THEN
            RAISE EXCEPTION 
                'Stock insuficiente para producto % (%). Stock actual: %, solicitado bajarlo a: %. '
                'Si desea permitir stock negativo, active permite_stock_negativo en el producto.',
                NEW.nombre, NEW.id, OLD.stock_actual, NEW.stock_actual;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- TOC entry 290 (class 1255 OID 27421)
-- Name: trg_salida_cocina_aprobacion(); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.trg_salida_cocina_aprobacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_detalle RECORD;
    v_nombre  VARCHAR(150);
BEGIN
    -- Solo actuar cuando aprobado cambia de FALSE a TRUE
    IF OLD.aprobado = FALSE AND NEW.aprobado = TRUE THEN

        -- Registrar la fecha de aprobación si no viene del caller
        IF NEW.fecha_aprobacion IS NULL THEN
            NEW.fecha_aprobacion := NOW();
        END IF;

        -- Iterar sobre los detalles de esta salida
        FOR v_detalle IN
            SELECT scd.producto_id, scd.cantidad
            FROM   inventario.salidas_cocina_detalle scd
            WHERE  scd.salida_id = NEW.id AND scd.activo = TRUE
        LOOP
            SELECT nombre INTO v_nombre
            FROM inventario.productos WHERE id = v_detalle.producto_id;

            PERFORM inventario.fn_kardex_movimiento(
                v_detalle.producto_id,
                'salida_cocina',
                v_detalle.cantidad,
                'salida_cocina',
                NEW.id,
                'Salida Cocina #' || NEW.id || ' - ' || v_nombre,
                NEW.aprobado_por
            );
        END LOOP;

    -- Si intenta des-aprobar: bloquear (la reversión es explícita por admin)
    ELSIF OLD.aprobado = TRUE AND NEW.aprobado = FALSE THEN
        RAISE EXCEPTION 'No se puede des-aprobar una salida de cocina. Use fn_revertir_kardex para cada movimiento asociado.';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- TOC entry 273 (class 1255 OID 27109)
-- Name: fn_validar_ciclo_menu(integer, integer); Type: FUNCTION; Schema: pos; Owner: -
--

CREATE FUNCTION pos.fn_validar_ciclo_menu(p_id integer, p_grupo_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_actual    INT := p_grupo_id;
    v_iteracion INT := 0;
BEGIN
    WHILE v_actual IS NOT NULL AND v_iteracion < 10 LOOP
        IF v_actual = p_id THEN
            RAISE EXCEPTION 'Ciclo detectado en grupo_menu_id: el ítem % ya es ancestro de %', p_id, p_grupo_id;
        END IF;
        SELECT grupo_menu_id INTO v_actual FROM pos.orden_detalles WHERE id = v_actual;
        v_iteracion := v_iteracion + 1;
    END LOOP;
END;
$$;


--
-- TOC entry 274 (class 1255 OID 27110)
-- Name: trg_validar_ciclo_menu_fn(); Type: FUNCTION; Schema: pos; Owner: -
--

CREATE FUNCTION pos.trg_validar_ciclo_menu_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.grupo_menu_id IS NOT NULL THEN
        PERFORM pos.fn_validar_ciclo_menu(NEW.id, NEW.grupo_menu_id);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- TOC entry 275 (class 1255 OID 27417)
-- Name: trg_venta_detalle_kardex(); Type: FUNCTION; Schema: pos; Owner: -
--

CREATE FUNCTION pos.trg_venta_detalle_kardex() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE 
    v_cajero_id INT; 
    v_controla_stock BOOLEAN; 
    v_nombre VARCHAR(150);
    v_costo_actual DECIMAL(14,4); -- Extraemos el costo real del producto
BEGIN
    SELECT cajero_id INTO v_cajero_id FROM pos.ventas WHERE id = NEW.venta_id;
    
    SELECT control_stock, nombre, costo_promedio 
    INTO v_controla_stock, v_nombre, v_costo_actual 
    FROM inventario.productos 
    WHERE id = NEW.producto_id;
    
    IF v_controla_stock = TRUE AND NEW.es_incluido_menu = FALSE AND NEW.activo = TRUE THEN
        -- Enviamos el 8vo parámetro (v_costo_actual)
        PERFORM inventario.fn_kardex_movimiento(
            NEW.producto_id, 
            'venta', 
            NEW.cantidad, 
            'venta', 
            NEW.venta_id, 
            'Venta #' || NEW.venta_id || ' - ' || v_nombre, 
            v_cajero_id,
            v_costo_actual  
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- TOC entry 291 (class 1255 OID 27423)
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- TOC entry 269 (class 1255 OID 26926)
-- Name: gen_numero_comanda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_comanda() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'C-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_comanda')::TEXT, 4, '0');
END;
$$;


--
-- TOC entry 271 (class 1255 OID 26928)
-- Name: gen_numero_compra(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_compra() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'OC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_compra')::TEXT, 4, '0');
END;
$$;


--
-- TOC entry 270 (class 1255 OID 26927)
-- Name: gen_numero_ticket(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_ticket() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'T-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_ticket')::TEXT, 4, '0');
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 231 (class 1259 OID 27025)
-- Name: alertas_stock; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.alertas_stock (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_alerta character varying(20) NOT NULL,
    stock_en_alerta numeric(10,3) NOT NULL,
    stock_minimo numeric(10,3) NOT NULL,
    referencia_tipo character varying(50),
    referencia_id integer,
    usuario_id integer,
    atendida boolean DEFAULT false NOT NULL,
    atendida_por integer,
    fecha_atencion timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT alertas_stock_tipo_alerta_check CHECK (((tipo_alerta)::text = ANY ((ARRAY['stock_bajo'::character varying, 'stock_negativo'::character varying])::text[])))
);


--
-- TOC entry 5410 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN alertas_stock.usuario_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.alertas_stock.usuario_id IS 'Usuario que ejecutó la operación que disparó la alerta (trazabilidad de auditoría).';


--
-- TOC entry 5411 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN alertas_stock.atendida_por; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.alertas_stock.atendida_por IS 'Usuario administrador que revisó y cerró la alerta.';


--
-- TOC entry 230 (class 1259 OID 27024)
-- Name: alertas_stock_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.alertas_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5412 (class 0 OID 0)
-- Dependencies: 230
-- Name: alertas_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.alertas_stock_id_seq OWNED BY inventario.alertas_stock.id;


--
-- TOC entry 227 (class 1259 OID 26982)
-- Name: categorias; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo public.item_tipo,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    color text DEFAULT '#3b82f6'::text NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 26981)
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5413 (class 0 OID 0)
-- Dependencies: 226
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.categorias_id_seq OWNED BY inventario.categorias.id;


--
-- TOC entry 249 (class 1259 OID 27262)
-- Name: compras; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.compras (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    usuario_id integer NOT NULL,
    numero_compra character varying(20) DEFAULT public.gen_numero_compra() NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text,
    fecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    tipo_comprobante character varying(30) DEFAULT 'Nota de Venta'::character varying NOT NULL,
    serie_comprobante character varying(10),
    numero_comprobante character varying(20),
    igv numeric(10,2) DEFAULT 0 NOT NULL,
    metodo_pago character varying(20) DEFAULT 'efectivo'::character varying,
    caja_movimiento_id integer,
    CONSTRAINT compras_igv_check CHECK ((igv >= (0)::numeric)),
    CONSTRAINT compras_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'credito'::character varying])::text[]))),
    CONSTRAINT compras_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT compras_total_check CHECK ((total >= (0)::numeric))
);


--
-- TOC entry 5414 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN compras.numero_compra; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.compras.numero_compra IS 'Correlativo interno del sistema (ej. COMP-0001)';


--
-- TOC entry 5415 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN compras.numero_comprobante; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.compras.numero_comprobante IS 'Número del documento físico entregado por el proveedor';


--
-- TOC entry 251 (class 1259 OID 27291)
-- Name: compras_detalle; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.compras_detalle (
    id integer NOT NULL,
    compra_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    costo_unitario numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS ((cantidad * costo_unitario)) STORED,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT compras_detalle_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT compras_detalle_costo_unitario_check CHECK ((costo_unitario >= (0)::numeric))
);


--
-- TOC entry 250 (class 1259 OID 27290)
-- Name: compras_detalle_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.compras_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5416 (class 0 OID 0)
-- Dependencies: 250
-- Name: compras_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.compras_detalle_id_seq OWNED BY inventario.compras_detalle.id;


--
-- TOC entry 248 (class 1259 OID 27261)
-- Name: compras_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.compras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5417 (class 0 OID 0)
-- Dependencies: 248
-- Name: compras_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.compras_id_seq OWNED BY inventario.compras.id;


--
-- TOC entry 257 (class 1259 OID 27358)
-- Name: kardex; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.kardex (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_movimiento public.kardex_tipo NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    stock_anterior numeric(10,3) NOT NULL,
    stock_nuevo numeric(10,3) NOT NULL,
    costo_unitario numeric(14,4),
    referencia_tipo character varying(50),
    referencia_id integer,
    referencia character varying(100),
    usuario_id integer,
    reversion_de integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    costo_promedio numeric(14,4) DEFAULT 0,
    valor_movimiento numeric(14,4) DEFAULT 0,
    valor_saldo numeric(14,4) DEFAULT 0,
    CONSTRAINT kardex_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- TOC entry 5418 (class 0 OID 0)
-- Dependencies: 257
-- Name: TABLE kardex; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.kardex IS 'Inmutable: nunca se borra ni se marca inactivo. Las anulaciones se registran como tipo reversion con reversion_de apuntando al movimiento original.';


--
-- TOC entry 256 (class 1259 OID 27357)
-- Name: kardex_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.kardex_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5419 (class 0 OID 0)
-- Dependencies: 256
-- Name: kardex_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.kardex_id_seq OWNED BY inventario.kardex.id;


--
-- TOC entry 229 (class 1259 OID 26996)
-- Name: productos; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.productos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    categoria_id integer NOT NULL,
    tipo public.item_tipo DEFAULT 'fondo'::public.item_tipo NOT NULL,
    precio_venta numeric(10,2) NOT NULL,
    costo_promedio numeric(14,4) DEFAULT 0 NOT NULL,
    control_stock boolean DEFAULT false NOT NULL,
    stock_actual numeric(10,3) DEFAULT 0 NOT NULL,
    stock_minimo numeric(10,3) DEFAULT 0 NOT NULL,
    permite_stock_negativo boolean DEFAULT false NOT NULL,
    unidad_medida character varying(20) DEFAULT 'unidad'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    disponible_en_menu boolean DEFAULT false NOT NULL,
    imagen_url text,
    CONSTRAINT productos_costo_promedio_check CHECK ((costo_promedio >= (0)::numeric)),
    CONSTRAINT productos_precio_venta_check CHECK ((precio_venta >= (0)::numeric)),
    CONSTRAINT productos_stock_minimo_check CHECK ((stock_minimo >= (0)::numeric))
);


--
-- TOC entry 5420 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN productos.permite_stock_negativo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.productos.permite_stock_negativo IS 'Si TRUE, fn_kardex_movimiento permite stock < 0 y genera alerta. Si FALSE, lanza excepción.';


--
-- TOC entry 228 (class 1259 OID 26995)
-- Name: productos_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5421 (class 0 OID 0)
-- Dependencies: 228
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.productos_id_seq OWNED BY inventario.productos.id;


--
-- TOC entry 247 (class 1259 OID 27248)
-- Name: proveedores; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.proveedores (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    ruc character varying(20),
    telefono character varying(20),
    direccion text,
    email character varying(100),
    tipo_producto character varying(100),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 246 (class 1259 OID 27247)
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5422 (class 0 OID 0)
-- Dependencies: 246
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.proveedores_id_seq OWNED BY inventario.proveedores.id;


--
-- TOC entry 253 (class 1259 OID 27313)
-- Name: salidas_cocina; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.salidas_cocina (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    turno public.turno_tipo NOT NULL,
    observaciones text,
    aprobado boolean DEFAULT false NOT NULL,
    aprobado_por integer,
    fecha_aprobacion timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 5423 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN salidas_cocina.aprobado; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.salidas_cocina.aprobado IS 'El descuento de kardex ocurre SOLO cuando este campo cambia a TRUE (trigger BEFORE UPDATE).';


--
-- TOC entry 255 (class 1259 OID 27336)
-- Name: salidas_cocina_detalle; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.salidas_cocina_detalle (
    id integer NOT NULL,
    salida_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT salidas_cocina_detalle_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- TOC entry 254 (class 1259 OID 27335)
-- Name: salidas_cocina_detalle_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.salidas_cocina_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5424 (class 0 OID 0)
-- Dependencies: 254
-- Name: salidas_cocina_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.salidas_cocina_detalle_id_seq OWNED BY inventario.salidas_cocina_detalle.id;


--
-- TOC entry 252 (class 1259 OID 27312)
-- Name: salidas_cocina_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.salidas_cocina_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5425 (class 0 OID 0)
-- Dependencies: 252
-- Name: salidas_cocina_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.salidas_cocina_id_seq OWNED BY inventario.salidas_cocina.id;


--
-- TOC entry 223 (class 1259 OID 26944)
-- Name: usuarios; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    usuario character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    correo character varying(150),
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuarios_correo_check CHECK (((correo)::text ~* '^[^@]+@[^@]+\.[^@]+$'::text)),
    CONSTRAINT usuarios_password_check CHECK ((length((password)::text) >= 60))
);


--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN usuarios.password; Type: COMMENT; Schema: pos; Owner: -
--

COMMENT ON COLUMN pos.usuarios.password IS 'Hash generado por la aplicación (bcrypt cost>=12 o Argon2id). NUNCA texto plano.';


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN usuarios.correo; Type: COMMENT; Schema: pos; Owner: -
--

COMMENT ON COLUMN pos.usuarios.correo IS 'Opcional. Usado para recuperación de contraseña y notificaciones. Validado con regex básico en BD.';


--
-- TOC entry 263 (class 1259 OID 27458)
-- Name: v_alertas_pendientes; Type: VIEW; Schema: inventario; Owner: -
--

CREATE VIEW inventario.v_alertas_pendientes AS
 SELECT a.id,
    p.nombre AS producto,
    p.unidad_medida,
    a.tipo_alerta,
    a.stock_en_alerta,
    a.stock_minimo,
    a.referencia_tipo,
    a.referencia_id,
    u.nombre AS generada_por,
    a.created_at AS fecha_alerta
   FROM ((inventario.alertas_stock a
     JOIN inventario.productos p ON ((p.id = a.producto_id)))
     LEFT JOIN pos.usuarios u ON ((u.id = a.usuario_id)))
  WHERE (a.atendida = false)
  ORDER BY a.created_at DESC;


--
-- TOC entry 268 (class 1259 OID 27572)
-- Name: v_kardex_completo; Type: VIEW; Schema: inventario; Owner: -
--

CREATE VIEW inventario.v_kardex_completo AS
 SELECT k.id,
    p.nombre AS producto,
    p.tipo AS producto_tipo,
    k.tipo_movimiento,
    k.cantidad,
    k.stock_anterior,
    k.stock_nuevo,
    k.costo_unitario,
    k.costo_promedio,
    k.valor_movimiento,
    k.valor_saldo,
    k.referencia_tipo,
    k.referencia,
    u.nombre AS usuario_responsable,
    k.reversion_de,
    k.created_at AS fecha
   FROM ((inventario.kardex k
     JOIN inventario.productos p ON ((p.id = k.producto_id)))
     LEFT JOIN pos.usuarios u ON ((u.id = k.usuario_id)))
  ORDER BY k.created_at DESC;


--
-- TOC entry 237 (class 1259 OID 27113)
-- Name: ventas; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.ventas (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    cajero_id integer NOT NULL,
    numero_ticket character varying(20) DEFAULT public.gen_numero_ticket() NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    igv numeric(10,2) DEFAULT 0 NOT NULL,
    descuento numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    metodo_pago public.pago_metodo NOT NULL,
    monto_pagado numeric(10,2) NOT NULL,
    vuelto numeric(10,2) GENERATED ALWAYS AS ((monto_pagado - total)) STORED,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ventas_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT ventas_igv_check CHECK ((igv >= (0)::numeric)),
    CONSTRAINT ventas_monto_pagado_check CHECK ((monto_pagado >= (0)::numeric)),
    CONSTRAINT ventas_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT ventas_total_check CHECK ((total >= (0)::numeric))
);


--
-- TOC entry 239 (class 1259 OID 27147)
-- Name: ventas_detalle; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.ventas_detalle (
    id integer NOT NULL,
    venta_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio)) STORED,
    es_incluido_menu boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ventas_detalle_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT ventas_detalle_precio_check CHECK ((precio >= (0)::numeric))
);


--
-- TOC entry 261 (class 1259 OID 27443)
-- Name: v_productos_mas_vendidos; Type: VIEW; Schema: inventario; Owner: -
--

CREATE VIEW inventario.v_productos_mas_vendidos AS
 SELECT p.id,
    p.nombre,
    p.tipo,
    c.nombre AS categoria,
    sum(vd.cantidad) AS total_vendido,
    sum(vd.subtotal) AS total_ingresos,
    p.stock_actual
   FROM (((pos.ventas_detalle vd
     JOIN inventario.productos p ON ((p.id = vd.producto_id)))
     JOIN inventario.categorias c ON ((c.id = p.categoria_id)))
     JOIN pos.ventas v ON ((v.id = vd.venta_id)))
  WHERE ((v.activo = true) AND (vd.activo = true) AND (vd.es_incluido_menu = false))
  GROUP BY p.id, p.nombre, p.tipo, c.nombre, p.stock_actual
  ORDER BY (sum(vd.cantidad)) DESC
 LIMIT 50;


--
-- TOC entry 260 (class 1259 OID 27433)
-- Name: v_stock_bajo; Type: VIEW; Schema: inventario; Owner: -
--

CREATE VIEW inventario.v_stock_bajo AS
 SELECT p.id,
    p.nombre,
    p.tipo,
    p.stock_actual,
    p.stock_minimo,
    p.unidad_medida,
    p.permite_stock_negativo,
    (p.stock_minimo - p.stock_actual) AS unidades_faltantes,
    c.nombre AS categoria
   FROM (inventario.productos p
     JOIN inventario.categorias c ON ((c.id = p.categoria_id)))
  WHERE ((p.control_stock = true) AND (p.stock_actual <= p.stock_minimo) AND (p.activo = true))
  ORDER BY (p.stock_minimo - p.stock_actual) DESC;


--
-- TOC entry 241 (class 1259 OID 27170)
-- Name: caja_aperturas; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.caja_aperturas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    monto_inicial numeric(10,2) NOT NULL,
    estado public.caja_estado DEFAULT 'abierta'::public.caja_estado NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT caja_aperturas_monto_inicial_check CHECK ((monto_inicial >= (0)::numeric))
);


--
-- TOC entry 240 (class 1259 OID 27169)
-- Name: caja_aperturas_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.caja_aperturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5428 (class 0 OID 0)
-- Dependencies: 240
-- Name: caja_aperturas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.caja_aperturas_id_seq OWNED BY pos.caja_aperturas.id;


--
-- TOC entry 265 (class 1259 OID 27495)
-- Name: caja_arqueos; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.caja_arqueos (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    monto_esperado numeric(10,2) NOT NULL,
    monto_contado numeric(10,2) NOT NULL,
    diferencia numeric(10,2) GENERATED ALWAYS AS ((monto_contado - monto_esperado)) STORED,
    observaciones text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 264 (class 1259 OID 27494)
-- Name: caja_arqueos_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.caja_arqueos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5429 (class 0 OID 0)
-- Dependencies: 264
-- Name: caja_arqueos_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.caja_arqueos_id_seq OWNED BY pos.caja_arqueos.id;


--
-- TOC entry 245 (class 1259 OID 27217)
-- Name: caja_cierres; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.caja_cierres (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    total_ventas numeric(10,2) DEFAULT 0 NOT NULL,
    total_efectivo numeric(10,2) DEFAULT 0 NOT NULL,
    total_tarjeta numeric(10,2) DEFAULT 0 NOT NULL,
    total_otro numeric(10,2) DEFAULT 0 NOT NULL,
    total_retiros numeric(10,2) DEFAULT 0 NOT NULL,
    total_gastos numeric(10,2) DEFAULT 0 NOT NULL,
    monto_inicial numeric(10,2) DEFAULT 0 NOT NULL,
    monto_final_real numeric(10,2) NOT NULL,
    observaciones text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    fondo_reservado_proximo numeric(10,2) DEFAULT 0 NOT NULL,
    monto_retirado_dueno numeric(10,2) DEFAULT 0 NOT NULL,
    total_ingresos numeric(10,2) DEFAULT 0 NOT NULL,
    monto_final_esperado numeric(10,2) DEFAULT 0 NOT NULL,
    diferencia numeric(10,2) DEFAULT 0 NOT NULL,
    turno character varying(20),
    CONSTRAINT chk_distribucion_cierre CHECK (((fondo_reservado_proximo + monto_retirado_dueno) <= monto_final_real))
);


--
-- TOC entry 244 (class 1259 OID 27216)
-- Name: caja_cierres_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.caja_cierres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5430 (class 0 OID 0)
-- Dependencies: 244
-- Name: caja_cierres_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.caja_cierres_id_seq OWNED BY pos.caja_cierres.id;


--
-- TOC entry 243 (class 1259 OID 27189)
-- Name: caja_movimientos; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.caja_movimientos (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    tipo public.caja_mov_tipo NOT NULL,
    descripcion text,
    monto numeric(10,2) NOT NULL,
    venta_id integer,
    usuario_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    referencia_tipo character varying(20),
    referencia_id integer,
    CONSTRAINT caja_movimientos_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_venta_solo_en_tipo_venta CHECK (((venta_id IS NULL) OR (tipo = 'venta'::public.caja_mov_tipo)))
);


--
-- TOC entry 5431 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN caja_movimientos.monto; Type: COMMENT; Schema: pos; Owner: -
--

COMMENT ON COLUMN pos.caja_movimientos.monto IS 'Siempre positivo. El tipo de movimiento (venta/retiro/gasto) indica la dirección contable.';


--
-- TOC entry 242 (class 1259 OID 27188)
-- Name: caja_movimientos_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.caja_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5432 (class 0 OID 0)
-- Dependencies: 242
-- Name: caja_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.caja_movimientos_id_seq OWNED BY pos.caja_movimientos.id;


--
-- TOC entry 225 (class 1259 OID 26967)
-- Name: mesas; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.mesas (
    id integer NOT NULL,
    numero integer NOT NULL,
    capacidad integer,
    estado public.mesa_estado DEFAULT 'libre'::public.mesa_estado NOT NULL,
    ubicacion character varying(50),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT mesas_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT mesas_numero_check CHECK ((numero > 0))
);


--
-- TOC entry 224 (class 1259 OID 26966)
-- Name: mesas_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.mesas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5433 (class 0 OID 0)
-- Dependencies: 224
-- Name: mesas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.mesas_id_seq OWNED BY pos.mesas.id;


--
-- TOC entry 235 (class 1259 OID 27076)
-- Name: orden_detalles; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.orden_detalles (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio)) STORED,
    observaciones text,
    estado_item public.orden_estado DEFAULT 'abierta'::public.orden_estado NOT NULL,
    es_incluido_menu boolean DEFAULT false NOT NULL,
    grupo_menu_id integer,
    enviado_cocina boolean DEFAULT false NOT NULL,
    fecha_envio_cocina timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    es_menu boolean DEFAULT false NOT NULL,
    entrada_incluida jsonb,
    fondo_incluido jsonb,
    CONSTRAINT chk_no_self_ref CHECK (((grupo_menu_id IS NULL) OR (grupo_menu_id <> id))),
    CONSTRAINT orden_detalles_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT orden_detalles_precio_check CHECK ((precio >= (0)::numeric))
);


--
-- TOC entry 234 (class 1259 OID 27075)
-- Name: orden_detalles_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.orden_detalles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5434 (class 0 OID 0)
-- Dependencies: 234
-- Name: orden_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.orden_detalles_id_seq OWNED BY pos.orden_detalles.id;


--
-- TOC entry 233 (class 1259 OID 27052)
-- Name: ordenes; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.ordenes (
    id integer NOT NULL,
    mesa_id integer,
    mesero_id integer NOT NULL,
    estado public.orden_estado DEFAULT 'abierta'::public.orden_estado NOT NULL,
    numero_comanda character varying(20) DEFAULT public.gen_numero_comanda() NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    fecha_cierre timestamp without time zone,
    tipo_pedido public.pedido_tipo DEFAULT 'salon'::public.pedido_tipo NOT NULL,
    descuento_tipo character varying(20) DEFAULT NULL::character varying,
    descuento_valor numeric(10,2) DEFAULT 0.00,
    descuento_total numeric(10,2) DEFAULT 0.00,
    motivo_descuento character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT chk_mesa_segun_tipo CHECK ((((tipo_pedido = 'salon'::public.pedido_tipo) AND (mesa_id IS NOT NULL)) OR ((tipo_pedido = ANY (ARRAY['llevar'::public.pedido_tipo, 'delivery'::public.pedido_tipo])) AND (mesa_id IS NULL))))
);


--
-- TOC entry 232 (class 1259 OID 27051)
-- Name: ordenes_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.ordenes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5435 (class 0 OID 0)
-- Dependencies: 232
-- Name: ordenes_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.ordenes_id_seq OWNED BY pos.ordenes.id;


--
-- TOC entry 221 (class 1259 OID 26930)
-- Name: roles; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.roles (
    id integer NOT NULL,
    nombre public.rol_tipo NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 220 (class 1259 OID 26929)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5436 (class 0 OID 0)
-- Dependencies: 220
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.roles_id_seq OWNED BY pos.roles.id;


--
-- TOC entry 259 (class 1259 OID 27382)
-- Name: tickets_cocina; Type: TABLE; Schema: pos; Owner: -
--

CREATE TABLE pos.tickets_cocina (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    tipo_ticket public.ticket_tipo DEFAULT 'pedido_cocina'::public.ticket_tipo NOT NULL,
    impreso boolean DEFAULT false NOT NULL,
    fecha_impresion timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 258 (class 1259 OID 27381)
-- Name: tickets_cocina_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.tickets_cocina_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5437 (class 0 OID 0)
-- Dependencies: 258
-- Name: tickets_cocina_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.tickets_cocina_id_seq OWNED BY pos.tickets_cocina.id;


--
-- TOC entry 222 (class 1259 OID 26943)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5438 (class 0 OID 0)
-- Dependencies: 222
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.usuarios_id_seq OWNED BY pos.usuarios.id;


--
-- TOC entry 262 (class 1259 OID 27453)
-- Name: v_caja_dia; Type: VIEW; Schema: pos; Owner: -
--

CREATE VIEW pos.v_caja_dia AS
 SELECT ca.id AS caja_id,
    u.nombre AS usuario_nombre,
    ca.monto_inicial,
    ca.created_at AS fecha_apertura,
    ca.estado,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'venta'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_ventas,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'retiro'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_retiros,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'gasto'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_gastos,
    (((ca.monto_inicial + COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'venta'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'retiro'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'gasto'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) AS saldo_esperado
   FROM ((pos.caja_aperturas ca
     JOIN pos.usuarios u ON ((u.id = ca.usuario_id)))
     LEFT JOIN pos.caja_movimientos cm ON ((cm.caja_id = ca.id)))
  WHERE ((ca.created_at)::date = CURRENT_DATE)
  GROUP BY ca.id, u.nombre, ca.monto_inicial, ca.created_at, ca.estado;


--
-- TOC entry 266 (class 1259 OID 27531)
-- Name: v_ordenes_pendientes; Type: VIEW; Schema: pos; Owner: -
--

CREATE VIEW pos.v_ordenes_pendientes AS
 SELECT o.id AS orden_id,
    o.numero_comanda,
    o.estado AS estado_orden,
    o.tipo_pedido,
    m.numero AS mesa_numero,
    m.ubicacion AS mesa_ubicacion,
    u.nombre AS mesero,
    count(od.id) AS total_items,
    sum(od.cantidad) AS total_unidades,
    sum(
        CASE
            WHEN (od.es_incluido_menu = false) THEN od.subtotal
            ELSE (0)::numeric
        END) AS total_cobrable,
    sum(
        CASE
            WHEN ((od.enviado_cocina = false) AND (od.activo = true)) THEN 1
            ELSE 0
        END) AS items_pendientes_envio,
    o.created_at AS hora_apertura,
    (EXTRACT(epoch FROM (now() - (o.created_at)::timestamp with time zone)) / (60)::numeric) AS minutos_abierta
   FROM (((pos.ordenes o
     LEFT JOIN pos.mesas m ON ((m.id = o.mesa_id)))
     JOIN pos.usuarios u ON ((u.id = o.mesero_id)))
     LEFT JOIN pos.orden_detalles od ON (((od.orden_id = o.id) AND (od.activo = true))))
  WHERE ((o.estado <> ALL (ARRAY['cobrada'::public.orden_estado, 'cancelada'::public.orden_estado])) AND (o.activo = true))
  GROUP BY o.id, o.numero_comanda, o.estado, o.tipo_pedido, m.numero, m.ubicacion, u.nombre, o.created_at
  ORDER BY o.created_at;


--
-- TOC entry 267 (class 1259 OID 27536)
-- Name: v_ventas_hoy; Type: VIEW; Schema: pos; Owner: -
--

CREATE VIEW pos.v_ventas_hoy AS
 SELECT v.id,
    v.numero_ticket,
    v.created_at AS fecha,
    o.tipo_pedido,
    m.numero AS mesa_numero,
    u.nombre AS cajero_nombre,
    v.total,
    v.metodo_pago,
    v.monto_pagado,
    v.vuelto
   FROM (((pos.ventas v
     JOIN pos.ordenes o ON ((o.id = v.orden_id)))
     LEFT JOIN pos.mesas m ON ((m.id = o.mesa_id)))
     JOIN pos.usuarios u ON ((u.id = v.cajero_id)))
  WHERE (((v.created_at)::date = CURRENT_DATE) AND (v.activo = true))
  ORDER BY v.created_at DESC;


--
-- TOC entry 238 (class 1259 OID 27146)
-- Name: ventas_detalle_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.ventas_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5439 (class 0 OID 0)
-- Dependencies: 238
-- Name: ventas_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.ventas_detalle_id_seq OWNED BY pos.ventas_detalle.id;


--
-- TOC entry 236 (class 1259 OID 27112)
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: pos; Owner: -
--

CREATE SEQUENCE pos.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5440 (class 0 OID 0)
-- Dependencies: 236
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: -
--

ALTER SEQUENCE pos.ventas_id_seq OWNED BY pos.ventas.id;


--
-- TOC entry 217 (class 1259 OID 26923)
-- Name: seq_comanda; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_comanda
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 219 (class 1259 OID 26925)
-- Name: seq_compra; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_compra
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 218 (class 1259 OID 26924)
-- Name: seq_ticket; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_ticket
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4943 (class 2604 OID 27028)
-- Name: alertas_stock id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alertas_stock ALTER COLUMN id SET DEFAULT nextval('inventario.alertas_stock_id_seq'::regclass);


--
-- TOC entry 4926 (class 2604 OID 26985)
-- Name: categorias id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.categorias ALTER COLUMN id SET DEFAULT nextval('inventario.categorias_id_seq'::regclass);


--
-- TOC entry 5006 (class 2604 OID 27265)
-- Name: compras id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras ALTER COLUMN id SET DEFAULT nextval('inventario.compras_id_seq'::regclass);


--
-- TOC entry 5017 (class 2604 OID 27294)
-- Name: compras_detalle id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras_detalle ALTER COLUMN id SET DEFAULT nextval('inventario.compras_detalle_id_seq'::regclass);


--
-- TOC entry 5029 (class 2604 OID 27361)
-- Name: kardex id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.kardex ALTER COLUMN id SET DEFAULT nextval('inventario.kardex_id_seq'::regclass);


--
-- TOC entry 4931 (class 2604 OID 26999)
-- Name: productos id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.productos ALTER COLUMN id SET DEFAULT nextval('inventario.productos_id_seq'::regclass);


--
-- TOC entry 5002 (class 2604 OID 27251)
-- Name: proveedores id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedores ALTER COLUMN id SET DEFAULT nextval('inventario.proveedores_id_seq'::regclass);


--
-- TOC entry 5021 (class 2604 OID 27316)
-- Name: salidas_cocina id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina ALTER COLUMN id SET DEFAULT nextval('inventario.salidas_cocina_id_seq'::regclass);


--
-- TOC entry 5026 (class 2604 OID 27339)
-- Name: salidas_cocina_detalle id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle ALTER COLUMN id SET DEFAULT nextval('inventario.salidas_cocina_detalle_id_seq'::regclass);


--
-- TOC entry 4980 (class 2604 OID 27173)
-- Name: caja_aperturas id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_aperturas ALTER COLUMN id SET DEFAULT nextval('pos.caja_aperturas_id_seq'::regclass);


--
-- TOC entry 5039 (class 2604 OID 27498)
-- Name: caja_arqueos id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_arqueos ALTER COLUMN id SET DEFAULT nextval('pos.caja_arqueos_id_seq'::regclass);


--
-- TOC entry 4988 (class 2604 OID 27220)
-- Name: caja_cierres id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_cierres ALTER COLUMN id SET DEFAULT nextval('pos.caja_cierres_id_seq'::regclass);


--
-- TOC entry 4985 (class 2604 OID 27192)
-- Name: caja_movimientos id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_movimientos ALTER COLUMN id SET DEFAULT nextval('pos.caja_movimientos_id_seq'::regclass);


--
-- TOC entry 4921 (class 2604 OID 26970)
-- Name: mesas id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.mesas ALTER COLUMN id SET DEFAULT nextval('pos.mesas_id_seq'::regclass);


--
-- TOC entry 4957 (class 2604 OID 27079)
-- Name: orden_detalles id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.orden_detalles ALTER COLUMN id SET DEFAULT nextval('pos.orden_detalles_id_seq'::regclass);


--
-- TOC entry 4946 (class 2604 OID 27055)
-- Name: ordenes id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ordenes ALTER COLUMN id SET DEFAULT nextval('pos.ordenes_id_seq'::regclass);


--
-- TOC entry 4913 (class 2604 OID 26933)
-- Name: roles id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.roles ALTER COLUMN id SET DEFAULT nextval('pos.roles_id_seq'::regclass);


--
-- TOC entry 5034 (class 2604 OID 27385)
-- Name: tickets_cocina id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.tickets_cocina ALTER COLUMN id SET DEFAULT nextval('pos.tickets_cocina_id_seq'::regclass);


--
-- TOC entry 4917 (class 2604 OID 26947)
-- Name: usuarios id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.usuarios ALTER COLUMN id SET DEFAULT nextval('pos.usuarios_id_seq'::regclass);


--
-- TOC entry 4966 (class 2604 OID 27116)
-- Name: ventas id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas ALTER COLUMN id SET DEFAULT nextval('pos.ventas_id_seq'::regclass);


--
-- TOC entry 4975 (class 2604 OID 27150)
-- Name: ventas_detalle id; Type: DEFAULT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas_detalle ALTER COLUMN id SET DEFAULT nextval('pos.ventas_detalle_id_seq'::regclass);


--
-- TOC entry 5098 (class 2606 OID 27033)
-- Name: alertas_stock alertas_stock_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_pkey PRIMARY KEY (id);


--
-- TOC entry 5088 (class 2606 OID 26994)
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- TOC entry 5090 (class 2606 OID 26992)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- TOC entry 5142 (class 2606 OID 27301)
-- Name: compras_detalle compras_detalle_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5137 (class 2606 OID 27279)
-- Name: compras compras_numero_compra_key; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_numero_compra_key UNIQUE (numero_compra);


--
-- TOC entry 5139 (class 2606 OID 27277)
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- TOC entry 5153 (class 2606 OID 27365)
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id);


--
-- TOC entry 5096 (class 2606 OID 27016)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- TOC entry 5133 (class 2606 OID 27258)
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- TOC entry 5135 (class 2606 OID 27260)
-- Name: proveedores proveedores_ruc_key; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedores
    ADD CONSTRAINT proveedores_ruc_key UNIQUE (ruc);


--
-- TOC entry 5147 (class 2606 OID 27346)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5145 (class 2606 OID 27324)
-- Name: salidas_cocina salidas_cocina_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_pkey PRIMARY KEY (id);


--
-- TOC entry 5123 (class 2606 OID 27182)
-- Name: caja_aperturas caja_aperturas_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_aperturas
    ADD CONSTRAINT caja_aperturas_pkey PRIMARY KEY (id);


--
-- TOC entry 5158 (class 2606 OID 27504)
-- Name: caja_arqueos caja_arqueos_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_arqueos
    ADD CONSTRAINT caja_arqueos_pkey PRIMARY KEY (id);


--
-- TOC entry 5129 (class 2606 OID 27236)
-- Name: caja_cierres caja_cierres_caja_id_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_caja_id_key UNIQUE (caja_id);


--
-- TOC entry 5131 (class 2606 OID 27234)
-- Name: caja_cierres caja_cierres_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_pkey PRIMARY KEY (id);


--
-- TOC entry 5125 (class 2606 OID 27199)
-- Name: caja_movimientos caja_movimientos_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_pkey PRIMARY KEY (id);


--
-- TOC entry 5084 (class 2606 OID 26980)
-- Name: mesas mesas_numero_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.mesas
    ADD CONSTRAINT mesas_numero_key UNIQUE (numero);


--
-- TOC entry 5086 (class 2606 OID 26978)
-- Name: mesas mesas_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.mesas
    ADD CONSTRAINT mesas_pkey PRIMARY KEY (id);


--
-- TOC entry 5111 (class 2606 OID 27093)
-- Name: orden_detalles orden_detalles_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_pkey PRIMARY KEY (id);


--
-- TOC entry 5106 (class 2606 OID 27064)
-- Name: ordenes ordenes_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_pkey PRIMARY KEY (id);


--
-- TOC entry 5074 (class 2606 OID 26942)
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- TOC entry 5076 (class 2606 OID 26940)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5156 (class 2606 OID 27391)
-- Name: tickets_cocina tickets_cocina_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.tickets_cocina
    ADD CONSTRAINT tickets_cocina_pkey PRIMARY KEY (id);


--
-- TOC entry 5078 (class 2606 OID 26960)
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- TOC entry 5080 (class 2606 OID 26956)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5082 (class 2606 OID 26958)
-- Name: usuarios usuarios_usuario_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);


--
-- TOC entry 5121 (class 2606 OID 27158)
-- Name: ventas_detalle ventas_detalle_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5115 (class 2606 OID 27135)
-- Name: ventas ventas_numero_ticket_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_numero_ticket_key UNIQUE (numero_ticket);


--
-- TOC entry 5117 (class 2606 OID 27133)
-- Name: ventas ventas_orden_id_key; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_orden_id_key UNIQUE (orden_id);


--
-- TOC entry 5119 (class 2606 OID 27131)
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5099 (class 1259 OID 27404)
-- Name: idx_alertas_no_atendidas; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_alertas_no_atendidas ON inventario.alertas_stock USING btree (producto_id) WHERE (atendida = false);


--
-- TOC entry 5100 (class 1259 OID 27050)
-- Name: idx_alertas_stock_fecha; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_alertas_stock_fecha ON inventario.alertas_stock USING btree (created_at DESC);


--
-- TOC entry 5101 (class 1259 OID 27049)
-- Name: idx_alertas_stock_producto; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_alertas_stock_producto ON inventario.alertas_stock USING btree (producto_id, atendida);


--
-- TOC entry 5140 (class 1259 OID 27412)
-- Name: idx_compras_proveedor; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_compras_proveedor ON inventario.compras USING btree (proveedor_id);


--
-- TOC entry 5148 (class 1259 OID 27399)
-- Name: idx_kardex_fecha; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_kardex_fecha ON inventario.kardex USING btree (created_at DESC);


--
-- TOC entry 5149 (class 1259 OID 27398)
-- Name: idx_kardex_producto; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_kardex_producto ON inventario.kardex USING btree (producto_id);


--
-- TOC entry 5150 (class 1259 OID 27400)
-- Name: idx_kardex_referencia; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_kardex_referencia ON inventario.kardex USING btree (referencia_tipo, referencia_id);


--
-- TOC entry 5151 (class 1259 OID 27401)
-- Name: idx_kardex_reversion; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_kardex_reversion ON inventario.kardex USING btree (reversion_de) WHERE (reversion_de IS NOT NULL);


--
-- TOC entry 5091 (class 1259 OID 27471)
-- Name: idx_productos_activo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_productos_activo ON inventario.productos USING btree (activo) WHERE (activo = false);


--
-- TOC entry 5092 (class 1259 OID 27473)
-- Name: idx_productos_disponible_menu; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_productos_disponible_menu ON inventario.productos USING btree (disponible_en_menu) WHERE (disponible_en_menu = true);


--
-- TOC entry 5093 (class 1259 OID 27402)
-- Name: idx_productos_stock_bajo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_productos_stock_bajo ON inventario.productos USING btree (stock_actual, stock_minimo) WHERE ((control_stock = true) AND (activo = true));


--
-- TOC entry 5094 (class 1259 OID 27403)
-- Name: idx_productos_tipo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_productos_tipo ON inventario.productos USING btree (tipo, control_stock);


--
-- TOC entry 5143 (class 1259 OID 27413)
-- Name: idx_salidas_cocina_fecha; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_salidas_cocina_fecha ON inventario.salidas_cocina USING btree (created_at DESC);


--
-- TOC entry 5159 (class 1259 OID 27515)
-- Name: idx_caja_arqueos_caja_id; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_caja_arqueos_caja_id ON pos.caja_arqueos USING btree (caja_id);


--
-- TOC entry 5160 (class 1259 OID 27516)
-- Name: idx_caja_arqueos_fecha; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_caja_arqueos_fecha ON pos.caja_arqueos USING btree (created_at DESC);


--
-- TOC entry 5126 (class 1259 OID 27410)
-- Name: idx_caja_mov_caja; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_caja_mov_caja ON pos.caja_movimientos USING btree (caja_id);


--
-- TOC entry 5127 (class 1259 OID 27411)
-- Name: idx_caja_mov_fecha; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_caja_mov_fecha ON pos.caja_movimientos USING btree (created_at DESC);


--
-- TOC entry 5107 (class 1259 OID 27414)
-- Name: idx_orden_detalle_menu; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_orden_detalle_menu ON pos.orden_detalles USING btree (grupo_menu_id) WHERE (es_incluido_menu = true);


--
-- TOC entry 5108 (class 1259 OID 27479)
-- Name: idx_orden_detalles_enviado_cocina; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_orden_detalles_enviado_cocina ON pos.orden_detalles USING btree (enviado_cocina) WHERE (enviado_cocina = false);


--
-- TOC entry 5109 (class 1259 OID 27478)
-- Name: idx_orden_detalles_orden_id; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_orden_detalles_orden_id ON pos.orden_detalles USING btree (orden_id);


--
-- TOC entry 5102 (class 1259 OID 27406)
-- Name: idx_ordenes_estado; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_ordenes_estado ON pos.ordenes USING btree (estado);


--
-- TOC entry 5103 (class 1259 OID 27407)
-- Name: idx_ordenes_fecha; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_ordenes_fecha ON pos.ordenes USING btree (created_at DESC);


--
-- TOC entry 5104 (class 1259 OID 27405)
-- Name: idx_ordenes_mesa; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_ordenes_mesa ON pos.ordenes USING btree (mesa_id);


--
-- TOC entry 5154 (class 1259 OID 27397)
-- Name: idx_tickets_no_impresos; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_tickets_no_impresos ON pos.tickets_cocina USING btree (orden_id) WHERE ((impreso = false) AND (activo = true));


--
-- TOC entry 5112 (class 1259 OID 27409)
-- Name: idx_ventas_cajero; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_ventas_cajero ON pos.ventas USING btree (cajero_id);


--
-- TOC entry 5113 (class 1259 OID 27408)
-- Name: idx_ventas_fecha; Type: INDEX; Schema: pos; Owner: -
--

CREATE INDEX idx_ventas_fecha ON pos.ventas USING btree (created_at DESC);


--
-- TOC entry 5208 (class 2620 OID 27420)
-- Name: compras_detalle trg_after_compra_detalle_insert; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_after_compra_detalle_insert AFTER INSERT ON inventario.compras_detalle FOR EACH ROW EXECUTE FUNCTION inventario.trg_compra_detalle_kardex();


--
-- TOC entry 5200 (class 2620 OID 27023)
-- Name: productos trg_before_producto_update; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_before_producto_update BEFORE UPDATE ON inventario.productos FOR EACH ROW EXECUTE FUNCTION inventario.trg_proteger_stock();


--
-- TOC entry 5209 (class 2620 OID 27422)
-- Name: salidas_cocina trg_before_salida_cocina_update; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_before_salida_cocina_update BEFORE UPDATE ON inventario.salidas_cocina FOR EACH ROW EXECUTE FUNCTION inventario.trg_salida_cocina_aprobacion();


--
-- TOC entry 5199 (class 2620 OID 27430)
-- Name: categorias trg_updated_at_categorias; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_updated_at_categorias BEFORE UPDATE ON inventario.categorias FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5207 (class 2620 OID 27432)
-- Name: compras trg_updated_at_compras; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_updated_at_compras BEFORE UPDATE ON inventario.compras FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5206 (class 2620 OID 27431)
-- Name: proveedores trg_updated_at_proveedores; Type: TRIGGER; Schema: inventario; Owner: -
--

CREATE TRIGGER trg_updated_at_proveedores BEFORE UPDATE ON inventario.proveedores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5204 (class 2620 OID 27418)
-- Name: ventas_detalle trg_after_venta_detalle_insert; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_after_venta_detalle_insert AFTER INSERT ON pos.ventas_detalle FOR EACH ROW EXECUTE FUNCTION pos.trg_venta_detalle_kardex();


--
-- TOC entry 5202 (class 2620 OID 27111)
-- Name: orden_detalles trg_orden_detalle_ciclo; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_orden_detalle_ciclo BEFORE INSERT OR UPDATE ON pos.orden_detalles FOR EACH ROW EXECUTE FUNCTION pos.trg_validar_ciclo_menu_fn();


--
-- TOC entry 5205 (class 2620 OID 27428)
-- Name: caja_aperturas trg_updated_at_caja_aperturas; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_caja_aperturas BEFORE UPDATE ON pos.caja_aperturas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5198 (class 2620 OID 27426)
-- Name: mesas trg_updated_at_mesas; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_mesas BEFORE UPDATE ON pos.mesas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5201 (class 2620 OID 27427)
-- Name: ordenes trg_updated_at_ordenes; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_ordenes BEFORE UPDATE ON pos.ordenes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5196 (class 2620 OID 27424)
-- Name: roles trg_updated_at_roles; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_roles BEFORE UPDATE ON pos.roles FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5197 (class 2620 OID 27425)
-- Name: usuarios trg_updated_at_usuarios; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_usuarios BEFORE UPDATE ON pos.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5203 (class 2620 OID 27429)
-- Name: ventas trg_updated_at_ventas; Type: TRIGGER; Schema: pos; Owner: -
--

CREATE TRIGGER trg_updated_at_ventas BEFORE UPDATE ON pos.ventas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5163 (class 2606 OID 27044)
-- Name: alertas_stock alertas_stock_atendida_por_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_atendida_por_fkey FOREIGN KEY (atendida_por) REFERENCES pos.usuarios(id);


--
-- TOC entry 5164 (class 2606 OID 27034)
-- Name: alertas_stock alertas_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5165 (class 2606 OID 27039)
-- Name: alertas_stock alertas_stock_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5181 (class 2606 OID 27487)
-- Name: compras compras_caja_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_caja_movimiento_id_fkey FOREIGN KEY (caja_movimiento_id) REFERENCES pos.caja_movimientos(id);


--
-- TOC entry 5184 (class 2606 OID 27302)
-- Name: compras_detalle compras_detalle_compra_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES inventario.compras(id) ON DELETE CASCADE;


--
-- TOC entry 5185 (class 2606 OID 27307)
-- Name: compras_detalle compras_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5182 (class 2606 OID 27280)
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES inventario.proveedores(id);


--
-- TOC entry 5183 (class 2606 OID 27285)
-- Name: compras compras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5190 (class 2606 OID 27366)
-- Name: kardex kardex_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5191 (class 2606 OID 27376)
-- Name: kardex kardex_reversion_de_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_reversion_de_fkey FOREIGN KEY (reversion_de) REFERENCES inventario.kardex(id);


--
-- TOC entry 5192 (class 2606 OID 27371)
-- Name: kardex kardex_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5162 (class 2606 OID 27017)
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES inventario.categorias(id);


--
-- TOC entry 5186 (class 2606 OID 27330)
-- Name: salidas_cocina salidas_cocina_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES pos.usuarios(id);


--
-- TOC entry 5188 (class 2606 OID 27352)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5189 (class 2606 OID 27347)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_salida_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES inventario.salidas_cocina(id) ON DELETE CASCADE;


--
-- TOC entry 5187 (class 2606 OID 27325)
-- Name: salidas_cocina salidas_cocina_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5175 (class 2606 OID 27183)
-- Name: caja_aperturas caja_aperturas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_aperturas
    ADD CONSTRAINT caja_aperturas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5194 (class 2606 OID 27505)
-- Name: caja_arqueos caja_arqueos_caja_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_arqueos
    ADD CONSTRAINT caja_arqueos_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES pos.caja_aperturas(id) ON DELETE CASCADE;


--
-- TOC entry 5195 (class 2606 OID 27510)
-- Name: caja_arqueos caja_arqueos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_arqueos
    ADD CONSTRAINT caja_arqueos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5179 (class 2606 OID 27237)
-- Name: caja_cierres caja_cierres_caja_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES pos.caja_aperturas(id);


--
-- TOC entry 5180 (class 2606 OID 27242)
-- Name: caja_cierres caja_cierres_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5176 (class 2606 OID 27200)
-- Name: caja_movimientos caja_movimientos_caja_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES pos.caja_aperturas(id);


--
-- TOC entry 5177 (class 2606 OID 27210)
-- Name: caja_movimientos caja_movimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5178 (class 2606 OID 27205)
-- Name: caja_movimientos caja_movimientos_venta_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES pos.ventas(id);


--
-- TOC entry 5168 (class 2606 OID 27104)
-- Name: orden_detalles orden_detalles_grupo_menu_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_grupo_menu_id_fkey FOREIGN KEY (grupo_menu_id) REFERENCES pos.orden_detalles(id);


--
-- TOC entry 5169 (class 2606 OID 27094)
-- Name: orden_detalles orden_detalles_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id) ON DELETE CASCADE;


--
-- TOC entry 5170 (class 2606 OID 27099)
-- Name: orden_detalles orden_detalles_producto_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5166 (class 2606 OID 27065)
-- Name: ordenes ordenes_mesa_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES pos.mesas(id);


--
-- TOC entry 5167 (class 2606 OID 27070)
-- Name: ordenes ordenes_mesero_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_mesero_id_fkey FOREIGN KEY (mesero_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5193 (class 2606 OID 27392)
-- Name: tickets_cocina tickets_cocina_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.tickets_cocina
    ADD CONSTRAINT tickets_cocina_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id);


--
-- TOC entry 5161 (class 2606 OID 26961)
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES pos.roles(id);


--
-- TOC entry 5171 (class 2606 OID 27141)
-- Name: ventas ventas_cajero_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_cajero_id_fkey FOREIGN KEY (cajero_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5173 (class 2606 OID 27164)
-- Name: ventas_detalle ventas_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5174 (class 2606 OID 27159)
-- Name: ventas_detalle ventas_detalle_venta_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES pos.ventas(id) ON DELETE CASCADE;


--
-- TOC entry 5172 (class 2606 OID 27136)
-- Name: ventas ventas_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: -
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id);


-- Completed on 2026-04-27 14:18:23

--
-- PostgreSQL database dump complete
--

\unrestrict HudmYzef6vYBbcSEl0eHrWX8ZNh75QMyDSNM4UiKSPm00SHwWIDbRj0TCtOQxeg

