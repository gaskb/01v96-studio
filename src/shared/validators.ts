import { z } from 'zod';

const targetChAuxBusStereo = z.enum(['ch', 'aux', 'bus', 'stereo']);
const targetChAuxBus = z.enum(['ch', 'aux', 'bus']);

export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_fader'),
    target: targetChAuxBusStereo,
    id: z.number().int().min(1).max(32),
    value: z.number().finite().min(0).max(1023),
  }),

  z.object({
    type: z.literal('set_on'),
    target: targetChAuxBusStereo,
    id: z.number().int().min(1).max(32),
    value: z.boolean(),
  }),

  z.object({
    type: z.literal('set_solo'),
    target: z.literal('ch'),
    id: z.number().int().min(1).max(32),
    value: z.boolean(),
  }),

  z.object({
    type: z.literal('set_pan'),
    target: targetChAuxBusStereo,
    id: z.number().int().min(1).max(32),
    value: z.number().finite().min(-63).max(63),
  }),

  z.object({
    type: z.literal('set_phase'),
    id: z.number().int().min(1).max(32),
    value: z.boolean(),
  }),

  z.object({
    type: z.literal('set_att'),
    id: z.number().int().min(1).max(32),
    value: z.number().finite().min(-960).max(180),
  }),

  z.object({
    type: z.literal('set_pair'),
    id: z.number().int().min(1).max(32),
    value: z.boolean(),
  }),

  z.object({
    type: z.literal('set_name'),
    target: targetChAuxBus.optional(),
    id: z.number().int().min(1).max(32),
    name: z.string().max(32),
  }),

  z.object({
    type: z.literal('set_eq'),
    target: targetChAuxBusStereo,
    id: z.number().int().min(1).max(32),
    param: z.string(),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_gate'),
    id: z.number().int().min(1).max(32),
    param: z.string(),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_comp'),
    target: targetChAuxBusStereo.optional(),
    id: z.number().int().min(1).max(32),
    param: z.string(),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_aux_send'),
    chId: z.number().int().min(1).max(32),
    auxId: z.number().int().min(1).max(8),
    param: z.enum(['level', 'on', 'pre']),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_routing'),
    id: z.number().int().min(1).max(32),
    target: z.enum(['stereo', 'direct', 'bus']),
    busIndex: z.number().int().min(0).max(7).optional(),
    value: z.boolean(),
  }),

  z.object({
    type: z.literal('set_delay'),
    id: z.number().int().min(1).max(32),
    on: z.boolean(),
    time: z.number().finite().min(0).max(1000),
  }),

  z.object({
    type: z.literal('select_channel'),
    id: z.number().int().min(1).max(32),
  }),

  z.object({
    type: z.literal('set_dual_view'),
    enabled: z.boolean(),
  }),

  z.object({
    type: z.literal('set_layer'),
    layer: z.number().int().min(0).max(5),
  }),

  z.object({
    type: z.literal('recall_scene'),
    sceneNumber: z.number().int().min(0).max(99),
  }),

  z.object({
    type: z.literal('store_scene'),
    sceneNumber: z.number().int().min(0).max(99),
    title: z.string().max(16).optional(),
  }),

  z.object({
    type: z.literal('set_effect'),
    rackId: z.number().int().min(1).max(4),
    param: z.enum([
      'mix',
      'type',
      'bypass',
      'param1',
      'param2',
      'param3',
      'param4',
      'param5',
      'param6',
      'param7',
      'param8',
    ]),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_geq'),
    unitId: z.number().int().min(1).max(4),
    param: z.string(),
    bandIndex: z.number().int().min(0).max(30).optional(),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('set_input_patch'),
    chId: z.number().int().min(1).max(32),
    sourcePort: z.number().int().min(0).max(64),
  }),

  z.object({
    type: z.literal('set_omni_patch'),
    omniId: z.number().int().min(1).max(4),
    sourceBus: z.number().int().min(0).max(16),
  }),

  z.object({
    type: z.literal('set_lcd_screen'),
    screenNo: z.number().int().min(0).max(32),
    tabNo: z.number().int().min(0).max(10).optional(),
  }),

  z.object({
    type: z.literal('set_setup_param'),
    param: z.string(),
    value: z.union([z.number().finite(), z.boolean()]),
  }),

  z.object({
    type: z.literal('sync_channel_strip'),
    id: z.number().int().min(1).max(32),
  }),

  z.object({
    type: z.literal('sync_all'),
  }),

  z.object({
    type: z.literal('set_deep_pair'),
    enabled: z.boolean(),
  }),

  z.object({
    type: z.literal('trigger_demo_wave'),
    mode: z.enum(['sine', 'bounce', 'v-shape', 'stop']).optional(),
  }),
]).refine(
  (cmd) => cmd.type !== 'set_routing' || cmd.target !== 'bus' || cmd.busIndex !== undefined,
  {
    message: 'busIndex (0..7) is required when target is "bus"',
    path: ['busIndex'],
  }
);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export function validateClientCommand(
  raw: unknown
): { success: true; data: ClientCommand } | { success: false; error: string } {
  const result = ClientCommandSchema.safeParse(raw);
  if (!result.success) {
    const errorMsg = result.error.errors
      .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
      .join(', ');
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}

export const SceneBackupDataSchema = z.object({
  number: z.number().int().min(0).max(99),
  title: z.string().max(64),
  channels: z.array(z.any()),
  auxes: z.array(z.any()),
  buses: z.array(z.any()),
  stereo: z.any(),
  effects: z.array(z.any()).optional(),
  labels: z
    .object({
      ch: z.record(z.string(), z.string()).optional(),
      aux: z.record(z.string(), z.string()).optional(),
      bus: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export const MixerBackupPackageSchema = z.object({
  format: z.literal('01v96-studio-backup'),
  version: z.string(),
  timestamp: z.string(),
  appVersion: z.string().optional(),
  uiVersion: z.string().optional(),
  apiVersion: z.string().optional(),
  metadata: z
    .object({
      name: z.string().optional(),
      author: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  global: z
    .object({
      layouts: z.any().optional(),
      activeLayer: z.number().int().min(0).max(5).optional(),
      dualChannelView: z.boolean().optional(),
      deepPair: z.boolean().optional(),
    })
    .optional(),
  scenes: z.record(z.string(), SceneBackupDataSchema),
});

export const RestorePlanSchema = z.object({
  restoreGlobal: z.boolean().optional(),
  writeHardware: z.boolean().optional(),
  scenes: z.array(
    z.object({
      sourceSceneNumber: z.number().int().min(0).max(99),
      targetSceneNumber: z.number().int().min(0).max(99),
    })
  ),
});

export const RestoreRequestSchema = z.object({
  package: MixerBackupPackageSchema,
  plan: RestorePlanSchema,
});

import type { RestoreRequest } from './types.js';

export function validateRestoreRequest(
  raw: unknown
): { success: true; data: RestoreRequest } | { success: false; error: string } {
  const result = RestoreRequestSchema.safeParse(raw);
  if (!result.success) {
    const errorMsg = result.error.errors
      .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
      .join(', ');
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data as unknown as RestoreRequest };
}
