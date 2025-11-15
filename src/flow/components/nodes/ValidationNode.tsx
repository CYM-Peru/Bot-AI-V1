import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getConditionData } from '../../utils/flow';
import { Shield, CheckCircle2 } from 'lucide-react';
import type { ValidationActionData } from '../../types';

function formatGroupKeywords(keywords: string[]): string {
  if (keywords.length === 0) {
    return 'Sin palabras clave';
  }
  if (keywords.length === 1) {
    return keywords[0];
  }
  if (keywords.length === 2) {
    return `${keywords[0]} · ${keywords[1]}`;
  }
  return `${keywords[0]}, ${keywords[1]} +${keywords.length - 2}`;
}

function getValidationData(node: any): ValidationActionData | null {
  if (node.action?.kind !== 'validation') return null;
  return (node.action.data as ValidationActionData) ?? null;
}

export function ValidationNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  // Try new validation data first, fallback to old condition data
  const validation = getValidationData(data.flowNode) ?? getConditionData(data.flowNode);

  const getValidationTypeLabel = (type?: string) => {
    switch (type) {
      case 'keywords': return 'Keywords';
      case 'format': return 'Formato';
      case 'variable': return 'Variable';
      case 'range': return 'Rango';
      case 'options_list': return 'Lista de Opciones';
      case 'length': return 'Longitud';
      case 'regex': return 'Expresión Regular';
      default: return 'Keywords';
    }
  };

  const validationType = (validation as ValidationActionData)?.validationType ?? 'keywords';

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Validación"
      badgeTone="validation"
      icon={<CheckCircle2 className="w-5 h-5" />}
      body={
        validation ? (
          <div className="space-y-2 text-xs text-slate-600">
            <div className="rounded-lg border border-green-200 bg-green-50/60 px-3 py-2 text-[11px]">
              <div className="font-semibold text-green-700">
                {getValidationTypeLabel(validationType)}
              </div>
            </div>

            {/* Keywords validation */}
            {validationType === 'keywords' && validation.keywordGroups && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">
                  {validation.keywordGroupLogic === 'and' ? 'Grupos AND' : 'Grupos OR'}
                </span>
                <div className="flex flex-wrap gap-1">
                  {validation.keywordGroups.map((group) => (
                    <span
                      key={group.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] text-slate-600"
                    >
                      <span className="text-[10px] uppercase text-slate-400">{group.mode === 'exact' ? 'Exacto' : 'Contiene'}</span>
                      <span className="font-medium text-slate-700">{formatGroupKeywords(group.keywords)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Format validation */}
            {validationType === 'format' && (validation as ValidationActionData).formatType && (
              <div className="text-[11px] text-slate-600">
                Formato: <span className="font-medium">{(validation as ValidationActionData).formatType}</span>
              </div>
            )}

            {/* Variable validation */}
            {validationType === 'variable' && (validation as ValidationActionData).variableName && (
              <div className="text-[11px] text-slate-600">
                Variable: <span className="font-medium">{(validation as ValidationActionData).variableName}</span>
              </div>
            )}

            {/* Range validation */}
            {validationType === 'range' && (
              <div className="text-[11px] text-slate-600">
                Rango: {(validation as ValidationActionData).min} - {(validation as ValidationActionData).max}
              </div>
            )}

            {/* Length validation */}
            {validationType === 'length' && (
              <div className="text-[11px] text-slate-600">
                Longitud: {(validation as ValidationActionData).minLength} - {(validation as ValidationActionData).maxLength}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Configura la validación en el inspector.</div>
        )
      }
    />
  );
}
