# 📁 Uploads

Esta carpeta contiene todos los archivos subidos por los usuarios:

- **Imágenes de productos** (jpg, png, webp, svg)
- **Imágenes de restaurantes** (logos, banners)
- **Comprobantes de pago** (Nequi, Daviplata, BRE-B)
- **Avatares de usuarios**

## ⚠️ NO SUBIR AL REPOSITORIO

Esta carpeta está excluida del repositorio (ver `.gitignore`).

## Estructura

```
uploads/
├── upload-{timestamp}-{hash}.{ext}  # Archivos generales
├── products/                        # (opcional) imágenes de productos
└── payment-proofs/                  # comprobantes de pago
```

## Backup

Los archivos en esta carpeta deben respaldarse periódicamente ya que
representan contenido generado por usuarios.
