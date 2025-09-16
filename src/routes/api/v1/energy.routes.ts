import type { Router } from "express";
import { EnergyTypeService } from "../../../services/energy.service.js";
import { EnergyTypeController } from "../../../controllers/energy.controller.js";
import { createEnergyTypeSchema, updateEnergyTypeSchema } from "../../../validations/energy.validation.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { validate } from "../../../utils/validate.js";

export const energyTypeRoutes = (router: Router) => {
  const prefix = '/energy-types';
  const energyTypeService = new EnergyTypeService();
  const energyTypeController = new EnergyTypeController(energyTypeService);

  // Endpoint untuk membuat dan mengambil semua jenis energi
  router
    .route(prefix)
    .post(
      // isAuthenticated, hasRole('Admin'), // -> Tambahkan middleware otentikasi & otorisasi di sini
      validate(createEnergyTypeSchema),
      asyncHandler(energyTypeController.createEnergyType)
    )
    .get(
      // isAuthenticated, // -> Cukup login untuk melihat
      asyncHandler(energyTypeController.getAllEnergyTypes)
    );

  // Endpoint untuk operasi pada satu jenis energi by ID
  router
    .route(`${prefix}/:id`)
    .get(
      // isAuthenticated,
      asyncHandler(energyTypeController.getEnergyTypeById)
    )
    .put(
      // isAuthenticated, hasRole('Admin'),
      validate(updateEnergyTypeSchema),
      asyncHandler(energyTypeController.updateEnergyType)
    )
    .delete(
      // isAuthenticated, hasRole('Admin'),
      asyncHandler(energyTypeController.deleteEnergyType)
    );
};
