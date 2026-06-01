# Minuta de Avance
## Sistema Web de Control Migratorio
**Fecha:** 22 de mayo de 2026  
**Proyecto:** Sistema Web de Control Migratorio  
**Estado general:** En desarrollo avanzado (MVP funcional operativo)

---

## 1) Resumen Ejecutivo (para jefatura)
### 1.1 Objetivo del sistema
Digitalizar el Acta de Control Migratorio para reemplazar registros manuales, centralizar la información y asegurar trazabilidad de acciones por usuario.

### 1.2 Avances clave completados
1. Plataforma web operativa con autenticación por RUN y contraseña.
2. Flujo de creación de casos por etapas (procedimiento, antecedentes, evidencias, observaciones, resumen y salida PDF).
3. Gestión de usuarios con control de roles y acciones administrativas.
4. Control territorial por JAF (Tarapacá, Antofagasta, Arica y Parinacota).
5. Dashboard con indicadores y últimos casos registrados.
6. Exportación PDF del acta con anexos de evidencia.
7. Trazabilidad de acciones críticas del sistema.
8. Despliegue en Render (frontend, backend y base de datos PostgreSQL).

### 1.3 Beneficios ya obtenidos
1. Reducción del riesgo de errores de transcripción manual.
2. Estandarización del registro de información migratoria.
3. Control de acceso por perfiles y por JAF.
4. Mayor capacidad de control y auditoría de la operación.
5. Disponibilidad remota para revisión de casos y documentos.

### 1.4 Estado del alcance
1. Módulos centrales funcionales: autenticación, casos, usuarios, evidencias, dashboard, auditoría.
2. Flujo mayor de edad y con menor de edad implementado en formulario.
3. Arquitectura lista para seguir creciendo sin reestructuración mayor.

### 1.5 Pendientes priorizados
1. Completar el módulo de reportería avanzada.
2. Incorporar perfiles operativos de cierre formal para PDI y Carabineros.
3. Definir y ajustar reglas finales de cierre de caso según protocolo.
4. Pulir formato final del PDF para alineación completa con plantillas institucionales.

---

## 2) Resumen Técnico (para equipo TI)
### 2.1 Stack implementado
1. Frontend: Angular + TypeScript.
2. Backend: NestJS + TypeScript (monolito modular).
3. Base de datos: PostgreSQL.
4. ORM: Prisma.
5. Despliegue: Render (frontend estático + backend web service + PostgreSQL).

### 2.2 Módulos funcionales actuales
1. Auth: login, control de sesión, cambio de contraseña, transferencia de administrador master.
2. Usuarios: crear, editar, activar, desactivar, resetear clave, eliminación lógica.
3. Casos: creación/edición por pasos, validaciones por etapa, detalle y consulta.
4. Evidencias: carga segura de archivos y metadatos en base de datos.
5. Documentos: generación de PDF de acta y anexos de evidencias.
6. Dashboard: indicadores operativos y tabla de últimos casos.
7. Auditoría/Trazabilidad: registro de eventos críticos y filtros operativos.

### 2.3 Seguridad aplicada
1. JWT para autenticación y autorización.
2. Hash de contraseñas en backend.
3. Guards por rol y restricciones por JAF.
4. Validaciones de datos en frontend y backend (DTO + class-validator).
5. Restricción de sesión activa de administrador.
6. RUN chileno validado con formato y dígito verificador.

### 2.4 Gobernanza de perfiles
1. Administrador Master: control total, incluida trazabilidad completa y gestión de auditores.
2. Administrador Operativo: administración limitada a su JAF.
3. Operador/Consulta: acceso restringido por JAF.
4. Auditor: revisión transversal sin funciones operativas de administración.

### 2.5 Datos y trazabilidad
1. Entidad central: Caso.
2. Relación con personas, evidencias y documentos.
3. Registro de auditoría para acciones sensibles.
4. Trazabilidad visible en módulo dedicado para perfil master.

### 2.6 Estado de despliegue
1. Sistema publicado en entorno Render.
2. Flujo de actualización por Git y redeploy.
3. Base PostgreSQL conectada y operativa.

### 2.7 Próximos hitos técnicos
1. Cierre formal de casos por perfiles PDI/Carabineros.
2. Reportería consolidada (Excel/PDF con filtros avanzados).
3. Endurecimiento adicional de políticas de sesión según definición institucional.
•. tiempo de expiración de sesión más estricto,
•. cierre automático por inactividad,
•. límites de sesiones simultáneas,
•. reglas de reautenticación para acciones sensibles.
•. Si recordar contraseña 
•. Bloqueo de cuenta por reintentos fallidos 
4. Ajuste fino de plantilla PDF final institucional.

---

## 3) Conclusión
El proyecto ya cuenta con una base funcional sólida y desplegada, alineada con el objetivo de digitalización del control migratorio. Se completó el núcleo operativo del sistema y quedó encaminada la fase final de cierre funcional (reportería y perfiles de cierre institucional).


