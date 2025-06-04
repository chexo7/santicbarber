# Santic Barber

Este proyecto utiliza Firebase para gestionar datos y analíticas. La clave de API incluida en el código es pública y no es un secreto en sí, pero es recomendable restringir su uso desde la consola de Firebase.

## Restringir la clave de API

1. Inicia sesión en [Firebase Console](https://console.firebase.google.com/).
2. Selecciona el proyecto **santicbarber**.
3. Entra en **Project settings** y busca la sección **Your apps**.
4. Localiza la **Firebase Web API Key** y abre las opciones de configuración.
5. Define restricciones de uso (por ejemplo, dominios permitidos) para evitar abusos.
6. Guarda los cambios.

## Configuración en producción

Para entornos de producción se recomienda mover esta configuración a un archivo separado o utilizar variables de entorno que se carguen al momento del despliegue.
