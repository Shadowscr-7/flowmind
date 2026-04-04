"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  LogOut,
  Zap,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useProfile } from "@/lib/hooks/useProfile";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [currencyDefault, setCurrencyDefault] = useState("UYU");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // WhatsApp
  const [waPhone, setWaPhone] = useState("");
  const [savingWa, setSavingWa] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setCurrencyDefault(profile.currency_default ?? "UYU");
      setWaPhone(profile.whatsapp_phone ?? "");
    }
  }, [profile]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await updateProfile({
      display_name: displayName,
      currency_default: currencyDefault,
    });

    setProfileMsg(
      error
        ? { type: "error", text: typeof error === "string" ? error : (error as { message: string }).message }
        : { type: "success", text: "Perfil actualizado correctamente" }
    );
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: "error",
        text: "Las contraseñas no coinciden",
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "La contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    setSavingPassword(true);
    setPasswordMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordMsg({ type: "error", text: error.message });
    } else {
      setPasswordMsg({
        type: "success",
        text: "Contraseña actualizada correctamente",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  }

  async function handleSaveWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    setSavingWa(true);
    setWaMsg(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const phone = waPhone.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_phone: phone || null })
      .eq("id", user.id);
    setWaMsg(
      error
        ? { type: "error", text: error.message }
        : { type: "success", text: phone ? "Número vinculado correctamente" : "Número desvinculado" }
    );
    setSavingWa(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <>
        <Header title="Configuración" />
        <FullPageSpinner />
      </>
    );
  }

  function Message({ msg }: { msg: { type: "success" | "error"; text: string } }) {
    return (
      <div
        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          msg.type === "success"
            ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
            : "bg-red-50 border border-red-100 text-red-700"
        }`}
      >
        {msg.type === "success" ? (
          <CheckCircle className="h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0" />
        )}
        {msg.text}
      </div>
    );
  }

  return (
    <>
      <Header title="Configuración" />
      <main className="flex-1 p-6 max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader
            title="Perfil"
            subtitle="Tu información personal"
          />
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800">
                {profile?.display_name ?? "Usuario"}
              </div>
              <div className="text-sm text-slate-500">Cuenta activa</div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileMsg && <Message msg={profileMsg} />}

            <Input
              label="Nombre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
            />

            <Select
              label="Moneda predeterminada"
              value={currencyDefault}
              onChange={(e) => setCurrencyDefault(e.target.value)}
            >
              <option value="UYU">UYU — Peso Uruguayo</option>
              <option value="USD">USD — Dólar Americano</option>
              <option value="EUR">EUR — Euro</option>
              <option value="ARS">ARS — Peso Argentino</option>
              <option value="BRL">BRL — Real Brasileño</option>
            </Select>

            <Button type="submit" loading={savingProfile}>
              Guardar cambios
            </Button>
          </form>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader
            title="Plan"
            subtitle="Tu suscripción actual"
          />
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 capitalize">
                  Plan {profile?.plan ?? "free"}
                </span>
                <Badge
                  variant={profile?.plan === "pro" ? "purple" : "default"}
                >
                  {profile?.plan === "pro" ? "Pro" : "Gratis"}
                </Badge>
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                Uso de IA este mes:{" "}
                <span className="font-medium text-slate-700">
                  {profile?.ai_usage_count ?? 0}
                </span>{" "}
                solicitudes
              </div>
            </div>
            {profile?.plan !== "pro" && (
              <Button variant="secondary" size="sm">
                Mejorar plan
              </Button>
            )}
          </div>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader
            title="WhatsApp"
            subtitle="Registrá gastos e ingresos enviando mensajes al bot"
          />
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 flex items-start gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Una vez vinculado podés enviar mensajes de texto o fotos de tickets al bot de WhatsApp y se registrarán automáticamente en tus cuentas.
            </span>
          </div>
          <form onSubmit={handleSaveWhatsApp} className="space-y-4">
            {waMsg && <Message msg={waMsg} />}
            <Input
              label="Número de WhatsApp"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="+59891234567"
            />
            <p className="text-xs text-slate-400">
              Ingresá tu número con código de país (ej: +598 para Uruguay). Este número debe coincidir con el WhatsApp desde el que enviás los mensajes.
            </p>
            <div className="flex gap-3">
              <Button type="submit" loading={savingWa} icon={<MessageSquare className="h-4 w-4" />}>
                {waPhone ? "Actualizar número" : "Vincular WhatsApp"}
              </Button>
              {waPhone && (
                <Button
                  type="button"
                  variant="secondary"
                  loading={savingWa}
                  onClick={async () => {
                    setWaPhone("");
                    setSavingWa(true);
                    setWaMsg(null);
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { error } = await supabase.from("profiles").update({ whatsapp_phone: null }).eq("id", user.id);
                      setWaMsg(error ? { type: "error", text: error.message } : { type: "success", text: "Número desvinculado" });
                    }
                    setSavingWa(false);
                  }}
                >
                  Desvincular
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader
            title="Cambiar contraseña"
            subtitle="Actualizá tu contraseña de acceso"
          />
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordMsg && <Message msg={passwordMsg} />}

            <Input
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="secondary"
              loading={savingPassword}
              icon={<Shield className="h-4 w-4" />}
            >
              Actualizar contraseña
            </Button>
          </form>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-100">
          <CardHeader
            title="Zona de peligro"
            subtitle="Acciones irreversibles"
          />
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
            <div>
              <div className="text-sm font-medium text-slate-800">
                Cerrar sesión
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Se cerrará tu sesión en este dispositivo
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              loading={signingOut}
              icon={<LogOut className="h-4 w-4" />}
              onClick={handleSignOut}
            >
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </main>
    </>
  );
}
