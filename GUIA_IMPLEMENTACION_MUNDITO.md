# Guía de implementación: Mundito

## Objetivo

Convertir el botón flotante del asistente de matrícula en **Mundito**, un pequeño planeta con apariencia esférica que gira lentamente. Tendrá nubes en movimiento y un halo azul que sugiera atmósfera. Un letrero sobre el planeta dirá **«¿Necesitas ayuda?»**. Al pulsarlo se abrirá el mismo diálogo de consultas que ya existe.

Esta guía se basa en la [vista previa pública del Colegio Nuevo Mundo](https://github.com/jhonretana2002-del/colegio-nuevo-mundo-preview). El README indica que el proyecto completo es privado. Por eso, los cambios siguientes se aplican en el código fuente correspondiente del proyecto completo y, si se desea, se replican en la exportación estática.

## Estado actual

- `index.html` contiene el botón `#matricula-chat-launcher` y el diálogo `#matricula-chat`.
- `matricula-chat.css` dibuja el botón rojo actual y el panel.
- `matricula-chat.js` muestra el botón, abre y cierra el diálogo, y genera respuestas de preguntas frecuentes.
- La vista previa aclara que el chat con asesores es una demostración. El cambio visual no debe alterar ese aviso.

## 1. Sustituir el contenido del botón flotante

En `index.html`, conservar el mismo `id`, la clase base, `aria-haspopup`, `aria-controls`, `aria-expanded` y `hidden`. Sustituir únicamente el SVG de burbuja y los textos internos por:

```html
<button type="button" id="matricula-chat-launcher"
  class="matricula-chat-launcher"
  aria-haspopup="dialog" aria-controls="matricula-chat"
  aria-expanded="false" aria-label="Abrir chat con Mundito" hidden>
  <span class="mundito-sign" aria-hidden="true">¿Necesitas ayuda?</span>
  <span class="mundito-globe" aria-hidden="true">
    <span class="mundito-surface"></span>
    <span class="mundito-clouds"></span>
  </span>
  <span class="mundito-name" aria-hidden="true">Mundito</span>
</button>
```

El letrero forma parte del botón: pulsarlo también abrirá el chat. Los elementos visuales llevan `aria-hidden` porque el nombre accesible ya está en el botón.

En el encabezado del diálogo, cambiar el título `Asistente de matrícula` por `Mundito · Asistente de matrícula`. Cambiar el `aria-label` del botón de cierre a `Cerrar chat con Mundito`. Se puede sustituir el icono de libro de `.matricula-chat-mark` por una versión pequeña del planeta, manteniendo ese icono como decorativo.

## 2. Agregar la textura del planeta

Copiar [mundito-map.svg](mundito-map.svg) y [mundito-clouds.svg](mundito-clouds.svg) junto a `matricula-chat.css`. Ambas son texturas vectoriales repetibles en horizontal. El volumen se consigue con luces y sombras CSS; la superficie y las nubes se desplazan a ritmos distintos para simular el giro del planeta y una atmósfera viva.

Si el proyecto completo usa un empaquetador o una carpeta de recursos, adaptar la ruta de `url(...)` a su estructura. En GitHub Pages, usar una ruta relativa a la hoja CSS evita depender del prefijo `/colegio-nuevo-mundo-preview/`.

## 3. Reemplazar los estilos del botón

En `matricula-chat.css`, reemplazar las reglas existentes de `.matricula-chat-launcher`, su estado `:hover`, sus reglas `svg`, `strong` y `small`, y los ajustes de ese botón dentro de `@media(max-width:600px)` por estas reglas. Mantener intactos los estilos del diálogo.

```css
.matricula-chat-launcher[hidden] { display: none; }

.matricula-chat-launcher {
  position: fixed;
  right: 24px;
  bottom: max(24px, env(safe-area-inset-bottom));
  z-index: 35;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 88px;
  min-height: 90px;
  padding: 8px 7px 6px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #1d3979;
  font-family: var(--sans);
  cursor: pointer;
  filter: drop-shadow(0 7px 10px #10214b38);
  transition: transform .2s ease, filter .2s ease;
}

.matricula-chat-launcher:hover {
  transform: translateY(-3px);
  filter: drop-shadow(0 10px 14px #10214b4d);
}

.matricula-chat-launcher:focus-visible {
  outline: 3px solid #b28a2e;
  outline-offset: 4px;
}

.mundito-sign {
  position: absolute;
  right: 0;
  bottom: calc(100% + 7px);
  width: max-content;
  max-width: min(170px, calc(100vw - 32px));
  padding: 8px 12px;
  border: 2px solid #1d3979;
  border-radius: 13px;
  background: #fff;
  color: #1d3979;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.mundito-sign::after {
  content: '';
  position: absolute;
  right: 23px;
  top: 100%;
  border: 7px solid transparent;
  border-top-color: #1d3979;
}

.mundito-globe {
  position: relative;
  display: block;
  width: 68px;
  height: 68px;
  overflow: hidden;
  border-radius: 50%;
  background: #167fc1;
  box-shadow: inset -9px -8px 13px #082c70a6,
              inset 4px 4px 8px #c8f5ff96,
              0 0 0 3px #e7faff,
              0 0 0 6px #8ad5efb3,
              0 0 17px 8px #9ce8ff99;
}

.mundito-surface {
  position: absolute;
  inset: 0;
  background-image: url('mundito-map.svg');
  background-repeat: repeat-x;
  background-size: 136px 68px;
  animation: mundito-rotation 40s linear infinite;
}

.mundito-clouds {
  position: absolute;
  inset: 0;
  background-image: url('mundito-clouds.svg');
  background-repeat: repeat-x;
  background-size: 136px 68px;
  animation: mundito-cloud-drift 62s linear infinite;
  opacity: .82;
  pointer-events: none;
}

.mundito-globe::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 28% 25%,
              #ffffff8a 0%, #ffffff24 25%, transparent 47%),
              linear-gradient(90deg, #082f661f 0%, transparent 42%, #071d62a6 100%);
  pointer-events: none;
}

.mundito-name {
  display: block;
  padding: 2px 8px;
  border-radius: 8px;
  background: #fff;
  color: #1d3979;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.3;
}

@keyframes mundito-rotation {
  from { background-position-x: 0; }
  to   { background-position-x: 136px; }
}

@keyframes mundito-cloud-drift {
  from { background-position-x: 0; }
  to   { background-position-x: -136px; }
}

@media (max-width: 600px) {
  .matricula-chat-launcher {
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
  }
}

@media (prefers-reduced-motion: reduce) {
  .mundito-surface, .mundito-clouds { animation: none; }
  .matricula-chat-launcher { transition: none; }
  .matricula-chat-launcher:hover { transform: none; }
}
```

La superficie tarda **40 segundos** por vuelta y las nubes se desplazan en sentido contrario durante **62 segundos**. Ambas vuelven al mismo punto de sus texturas sin salto visible. La capa de luces queda fija mientras los continentes y las nubes se desplazan, lo cual refuerza la sensación de esfera. Si el cliente desea otro ritmo, ajustar las duraciones de ambas animaciones y mantener la de las nubes más lenta.

## 4. Actualizar el nombre en JavaScript

En `matricula-chat.js`, dentro de `message()`, cambiar el autor de las respuestas del bot:

```js
item.append(
  make('span', from === 'user' ? 'Usted' : 'Mundito', 'matricula-message-author'),
  make('p', text)
);
```

Los selectores y los eventos de abrir y cerrar permanecen iguales. No hace falta crear un chatbot nuevo para este cambio. Si se busca una voz más cercana, actualizar también el saludo de `.matricula-chat-welcome` a: `¡Hola! Soy Mundito. Puedo orientarle sobre matrícula, requisitos, costos, cupos y visitas.` Conservar las aclaraciones actuales sobre información por confirmar y sobre la ausencia de conexión con asesores.

## 5. Comprobación antes de publicar

1. Abrir la página en escritorio y móvil: el letrero debe quedar encima del planeta, sin salirse de la pantalla ni tapar contenido importante.
2. Verificar que el planeta y las nubes se muevan de forma continua, suave y lenta; que el halo azul sea visible; que el panel se abra al pulsar cualquier parte del botón; y que cierre con el botón y con `Esc`.
3. Navegar con teclado: el botón debe recibir foco visible, `Enter` y `Espacio` deben abrirlo, y al cerrar el foco debe regresar a Mundito.
4. Activar la preferencia del sistema «reducir movimiento»: el planeta y las nubes deben quedar inmóviles.
5. Confirmar que el lector de pantalla anuncia `Abrir chat con Mundito` y que las respuestas llevan el autor `Mundito`.
6. Confirmar que `mundito-map.svg` y `mundito-clouds.svg` se cargan sin error tanto en la ruta local como en GitHub Pages, y que los avisos de demostración siguen visibles.

**Criterio de entrega:** Mundito aparece como un planeta reconocible con sombra, iluminación, nubes y atmósfera; gira lentamente, muestra «¿Necesitas ayuda?» encima y conserva las funciones actuales del asistente.
