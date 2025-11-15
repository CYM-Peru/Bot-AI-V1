import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { Shield, Database } from 'lucide-react';
import type { ValidationBitrixActionData } from '../../types';

function getValidationBitrixData(node: any): ValidationBitrixActionData | null {
  if (node.action?.kind !== 'validation_bitrix') return null;
  return (node.action.data as ValidationBitrixActionData) ?? null;
}

export function ValidationBitrixNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const validation = getValidationBitrixData(data.flowNode);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'exists':
        return 'Verificar Existencia';
      case 'field':
        return 'Validar Campo';
      case 'multiple_fields':
        return 'Validar Múltiples Campos';
      default:
        return 'Validación';
    }
  };

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Bitrix"
      badgeTone="bitrix"
      icon={<Database className="w-5 h-5" />}
      body={
        validation ? (
          <div className="space-y-3 text-xs text-slate-600">
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px]">
              <div className="font-semibold text-blue-700">
                {getTypeLabel(validation.validationType)}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  {validation.entityType}
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  por {validation.identifierField}
                </span>
              </div>
            </div>

            {validation.validationType !== 'exists' && validation.fieldChecks && validation.fieldChecks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Campos a validar</span>
                  {validation.validationType === 'multiple_fields' && validation.matchMode && (
                    <span className="text-[10px] text-slate-400 uppercase">
                      {validation.matchMode === 'all' ? 'Todos' : 'Cualquiera'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {validation.fieldChecks.map((check) => (
                    <span
                      key={check.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] text-slate-600"
                    >
                      <span className="font-medium text-slate-700">{check.fieldName}</span>
                      <span className="text-[10px] text-slate-400">{check.operator}</span>
                      <span className="text-slate-600">&quot;{check.expectedValue}&quot;</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Configura la validación Bitrix en el inspector.</div>
        )
      }
    />
  );
}
