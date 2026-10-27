# Guía de implementación: Lumi

El asistente de matrícula se llama **Lumi**. Su identidad usa el robot con el emblema institucional en el pecho, el aro dorado y el letrero «¿Necesitas ayuda?».

## Archivos

- `index.html`: botón flotante, capas del personaje, encabezado y saludo inicial.
- `matricula-chat.css`: presentación, recortes y animación de la mano.
- `matricula-chat.js`: apertura, cierre, preguntas frecuentes y autor de las respuestas.
- `assets/mundito-saludo-4frames.png`: arte aprobado. El nombre del archivo conserva la referencia histórica del recurso.

## Saludo natural

La animación utiliza una única pose de la tira original. La cara y el emblema conservan los píxeles de esa pose. El cuerpo queda en una capa fija; la mano se recorta en otra y gira sobre la muñeca, de −9° a 11°. El aro dorado se dibuja en una capa independiente para permanecer completo y estable durante el saludo.

`lumi-hand-wave` usa una curva suave y dirección alterna: la mano desacelera al llegar a cada extremo y vuelve por el mismo recorrido. Cada recorrido tarda 0,7 segundos, por lo que el ciclo completo dura 1,4 segundos. No se alternan las cuatro poses completas, lo que evita saltos en la cabeza, el cuerpo y el emblema.

Para ajustar el gesto, cambiar únicamente los ángulos de `lumi-hand-wave` o su duración en `.lumi-hand`. El punto de giro se define en `transform-origin`. Mantener los recortes ligados al arte de referencia; si se reemplaza la imagen, habrá que recalibrarlos.

La miniatura del encabezado queda estática. `prefers-reduced-motion: reduce` deja también estático el botón flotante. Los nombres accesibles, el saludo y el autor de las respuestas muestran «Lumi».

## Publicación

La vista previa está alojada en GitHub Pages bajo `/colegio-nuevo-mundo-preview/`. El CSS resuelve la imagen de forma relativa. Cuando se cambian los estilos o el JavaScript, actualizar la versión de sus enlaces en `index.html` para renovar la caché.

La atención con un asesor sigue siendo una demostración sin envío de mensajes. El proyecto completo privado contiene las funciones del servidor.
