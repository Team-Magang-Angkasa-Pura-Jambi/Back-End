// // src/routes/efficiencyTarget.routes.ts

// import { Router } from 'express';

// import { createCrudRouter } from '../../../utils/routerFactory.js';
// import { EfficiencyTargetService } from '../../../services/efficiencyTarget.service.js';
// import {
//   createEfficiencyTargetSchema,
//   efficiencyTargetParamsSchema,
//   updateEfficiencyTargetSchema,
// } from '../../../validations/efficiencyTargets.validation.js';
// import { EfficiencyTargetController } from '../../../controllers/efficiencyTarget.controller.js';

// export default (router: Router) => {
//   // Gunakan pabrik untuk membuat semua rute CRUD secara otomatis
//   const efficiencyTargetRouter = createCrudRouter('/efficiency-targets', {
//     ServiceClass: EfficiencyTargetService,
//     ControllerClass: EfficiencyTargetController,
//     idParamName: 'target_id', // Sesuaikan nama parameter ID
//     schemas: {
//       create: createEfficiencyTargetSchema,
//       update: updateEfficiencyTargetSchema,
//       params: efficiencyTargetParamsSchema,
//     },
//   });

//   // Gabungkan router yang baru dibuat ke router utama aplikasi
//   router.use(efficiencyTargetRouter);
// };
