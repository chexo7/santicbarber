# Santic Barber

Este proyecto es una aplicación web para la gestión de reservas en la barbería **Santic Barber**. Utiliza HTML, CSS y JavaScript puro junto con Firebase para almacenar información de citas y servicios. Incluye un panel de administración para gestionar horario, bloqueos y servicios.

## Despliegue

1. **Clonar el repositorio**:
   ```bash
   git clone <repo-url>
   cd santicbarber
   ```
2. **Configurar Firebase**: reemplazar las credenciales en `index.html` y `admin.html` por las de tu propio proyecto de Firebase.
3. **Hospedaje estático**: puedes servir los archivos con cualquier hosting de archivos estáticos (por ejemplo Vercel). El archivo `vercel.json` redirige la ruta `/admin` a `admin.html`.
4. **Base de datos**: utiliza Firebase Realtime Database. Las reglas de seguridad se encuentran en `database.rules.json`.

## Seguridad

- **Mantén en secreto las claves de Firebase**. Las claves incluidas son de ejemplo y deben sustituirse antes de desplegar.
- Utiliza reglas de base de datos que restrinjan la escritura a usuarios autenticados (ver `database.rules.json`).
- Configura HTTPS en el entorno de producción para proteger la información de los usuarios.

## Licencia

Este proyecto está distribuido bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más información.
