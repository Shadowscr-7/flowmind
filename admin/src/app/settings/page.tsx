'use client';

import { useState } from 'react';
import { Settings as SettingsIcon, Globe, Key, Bell, Palette, Database, Save } from 'lucide-react';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ElementType;
  fields: SettingField[];
}

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'toggle' | 'select' | 'number';
  value: string | boolean | number;
  options?: string[];
  description?: string;
}

const initialSections: SettingSection[] = [
  {
    id: 'general',
    title: 'General',
    icon: Globe,
    fields: [
      { key: 'appName', label: 'Nombre de la App', type: 'text', value: 'Flowmind' },
      { key: 'defaultCurrency', label: 'Moneda por Defecto', type: 'select', value: 'UYU', options: ['UYU', 'USD', 'ARS', 'BRL', 'EUR'] },
      { key: 'defaultLanguage', label: 'Idioma', type: 'select', value: 'es', options: ['es', 'en', 'pt'] },
      { key: 'maintenanceMode', label: 'Modo Mantenimiento', type: 'toggle', value: false, description: 'Activa para mostrar pantalla de mantenimiento a los usuarios.' },
    ],
  },
  {
    id: 'ai',
    title: 'Inteligencia Artificial',
    icon: Key,
    fields: [
      { key: 'openaiModel', label: 'Modelo OpenAI', type: 'select', value: 'gpt-4o-mini', options: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { key: 'maxAiRequestsFree', label: 'Límite IA (Free)', type: 'number', value: 50, description: 'Requests mensuales para plan free.' },
      { key: 'maxAiRequestsPro', label: 'Límite IA (Pro)', type: 'number', value: 500, description: 'Requests mensuales para plan pro.' },
      { key: 'aiConfidenceThreshold', label: 'Umbral Confianza IA', type: 'number', value: 0.7, description: 'Debajo de esto se pide confirmación al usuario.' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    icon: Bell,
    fields: [
      { key: 'pushEnabled', label: 'Push Notifications', type: 'toggle', value: true },
      { key: 'emailDigest', label: 'Email Semanal', type: 'toggle', value: false, description: 'Envía resumen semanal por email a usuarios activos.' },
      { key: 'alertEmailAdmin', label: 'Email Admin Alertas', type: 'text', value: 'admin@flowmind.app' },
    ],
  },
  {
    id: 'appearance',
    title: 'Apariencia',
    icon: Palette,
    fields: [
      { key: 'primaryColor', label: 'Color Primario', type: 'text', value: '#6C63FF' },
      { key: 'accentColor', label: 'Color Acento', type: 'text', value: '#00BFA6' },
      { key: 'darkModeDefault', label: 'Dark Mode por Defecto', type: 'toggle', value: false },
    ],
  },
  {
    id: 'data',
    title: 'Datos & Storage',
    icon: Database,
    fields: [
      { key: 'maxReceiptSizeMb', label: 'Tamaño Máx. Recibo (MB)', type: 'number', value: 5 },
      { key: 'retentionDays', label: 'Retención de Datos (días)', type: 'number', value: 365 },
      { key: 'autoBackup', label: 'Backup Automático', type: 'toggle', value: true },
    ],
  },
];

export default function SettingsPage() {
  const [sections, setSections] = useState<SettingSection[]>(initialSections);
  const [saved, setSaved] = useState(false);

  const updateField = (sectionId: string, fieldKey: string, newValue: string | boolean | number) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) => (f.key === fieldKey ? { ...f, value: newValue } : f)),
            }
          : s
      )
    );
    setSaved(false);
  };

  const handleSave = () => {
    // TODO: Save to Supabase app_settings table
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">Ajustes generales de la plataforma</p>
        </div>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <section.icon className="w-5 h-5 text-brand-500" />
            <h3 className="text-lg font-semibold">{section.title}</h3>
          </div>
          <div className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                  {field.description && <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>}
                </div>
                <div className="w-64">
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="input w-full"
                      value={field.value as string}
                      onChange={(e) => updateField(section.id, field.key, e.target.value)}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="input w-full"
                      value={field.value as number}
                      onChange={(e) => updateField(section.id, field.key, parseFloat(e.target.value) || 0)}
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      className="input w-full"
                      value={field.value as string}
                      onChange={(e) => updateField(section.id, field.key, e.target.value)}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {field.type === 'toggle' && (
                    <button
                      onClick={() => updateField(section.id, field.key, !(field.value as boolean))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        field.value ? 'bg-brand-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          field.value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
