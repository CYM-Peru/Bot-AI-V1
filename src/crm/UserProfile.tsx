import { useState, useEffect } from "react";
import { apiUrl } from "../lib/apiBase";
import { Avatar } from "./Avatar";

interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: string;
  avatarUrl?: string;
}

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onUserUpdate?: () => void;
}

const CHAT_BACKGROUNDS = [
  { id: "default", name: "Predeterminado", color: "from-slate-50 to-blue-50" },
  { id: "purple", name: "Púrpura", color: "from-purple-50 to-pink-50" },
  { id: "green", name: "Verde", color: "from-green-50 to-emerald-50" },
  { id: "orange", name: "Naranja", color: "from-orange-50 to-amber-50" },
  { id: "blue", name: "Azul", color: "from-blue-50 to-cyan-50" },
  { id: "rose", name: "Rosa", color: "from-rose-50 to-pink-50" },
  { id: "gray", name: "Gris", color: "from-gray-50 to-slate-50" },
];

export default function UserProfile({ user, onClose, onUserUpdate }: UserProfileProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "password" | "preferences" | "notifications" | "chatTheme">("profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is advisor
  const isAdvisor = user?.role === "asesor";

  // Chat theme preferences
  const [chatTheme, setChatTheme] = useState({
    fontFamily: "system-ui",
    fontSize: "13px",
    fontWeight: "400",
    incomingBubbleBg: "#ffffff",
    incomingTextColor: "#1e293b",
    outgoingBubbleBg: "#10b981",
    outgoingTextColor: "#ffffff",
    chatBackgroundImage: "",
    chatBackgroundColor: "",
  });
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  // Profile form
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Preferences
  const [chatBackground, setChatBackground] = useState(() => {
    return localStorage.getItem("crm:chat:background") || "default";
  });

  // Notification settings (only for advisors)
  const [browserNotifications, setBrowserNotifications] = useState(() => {
    return localStorage.getItem("crm:notifications:browser") === "true";
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem("crm:notifications:sound") !== "false";
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    return parseInt(localStorage.getItem("crm:notifications:volume") || "70");
  });
  const [messagePreview, setMessagePreview] = useState(() => {
    return localStorage.getItem("crm:notifications:preview") !== "false";
  });
  const [newChatNotifications, setNewChatNotifications] = useState(() => {
    return localStorage.getItem("crm:notifications:newChat") !== "false";
  });
  const [clientMessageNotifications, setClientMessageNotifications] = useState(() => {
    return localStorage.getItem("crm:notifications:clientMessage") !== "false";
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  // Load chat theme preferences when tab is activated
  useEffect(() => {
    if (activeTab === "chatTheme") {
      loadChatTheme();
    }
  }, [activeTab]);

  const loadChatTheme = async () => {
    setLoadingTheme(true);
    try {
      const response = await fetch(apiUrl("/api/user-profile/chat-theme"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.preferences) {
          setChatTheme(data.preferences);
        }
      }
    } catch (error) {
      console.error("Error loading chat theme:", error);
    } finally {
      setLoadingTheme(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setMessage({ type: "error", text: "Por favor selecciona una imagen válida" });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "La imagen no debe superar los 5MB" });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Upload avatar if changed
      let avatarUrl = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);

        const uploadRes = await fetch(apiUrl("/api/user/avatar"), {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadRes.ok) {
          throw new Error("Error al subir la imagen");
        }

        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.avatarUrl;
      }

      // Update profile
      const response = await fetch(apiUrl("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          ...(avatarUrl && { avatarUrl }),
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Perfil actualizado correctamente" });
        if (onUserUpdate) {
          await onUserUpdate();
        }
        setAvatarFile(null);
        setAvatarPreview(null);
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.message || "Error al actualizar el perfil" });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage({ type: "error", text: "Error al guardar los cambios" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(apiUrl("/api/user/password"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Contraseña cambiada correctamente" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.message || "Error al cambiar la contraseña" });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage({ type: "error", text: "Error al cambiar la contraseña" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem("crm:chat:background", chatBackground);
    setMessage({ type: "success", text: "Preferencias guardadas" });
    // Trigger a custom event to notify chat window
    window.dispatchEvent(new CustomEvent("chat-background-changed", { detail: chatBackground }));
  };

  const handleSaveNotifications = async () => {
    // Save notification settings to localStorage
    localStorage.setItem("crm:notifications:browser", browserNotifications.toString());
    localStorage.setItem("crm:notifications:sound", soundAlerts.toString());
    localStorage.setItem("crm:notifications:volume", soundVolume.toString());
    localStorage.setItem("crm:notifications:preview", messagePreview.toString());
    localStorage.setItem("crm:notifications:newChat", newChatNotifications.toString());
    localStorage.setItem("crm:notifications:clientMessage", clientMessageNotifications.toString());

    // Request browser notification permission if enabled
    if (browserNotifications && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    setMessage({ type: "success", text: "Configuración de notificaciones guardada" });
  };

  const handleSaveChatTheme = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(apiUrl("/api/user-profile/chat-theme"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: chatTheme }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Tema del chat guardado correctamente" });
        // Trigger a custom event to notify message bubbles to reload
        window.dispatchEvent(new CustomEvent("chat-theme-changed", { detail: chatTheme }));
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.message || "Error al guardar el tema" });
      }
    } catch (error) {
      console.error("Error saving chat theme:", error);
      setMessage({ type: "error", text: "Error al guardar el tema" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">⚙️ Mi Perfil</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "profile"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            👤 Perfil
          </button>
          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "password"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            🔒 Contraseña
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "preferences"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            🎨 Preferencias
          </button>
          <button
            onClick={() => setActiveTab("chatTheme")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "chatTheme"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            💬 Tema de Chat
          </button>
          {isAdvisor && (
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "notifications"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              🔔 Notificaciones
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Message */}
          {message && (
            <div
              className={`mb-4 rounded-lg border p-3 ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar
                  src={avatarPreview || user?.avatarUrl || null}
                  alt={user?.name || "Usuario"}
                  size="xl"
                />
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Foto de perfil
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition"
                  />
                  <p className="mt-1 text-xs text-slate-500">PNG, JPG hasta 5MB</p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-100"
                  placeholder="Tu nombre"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-100"
                  placeholder="tu@email.com"
                />
              </div>

              {/* Username (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  value={user?.username || ""}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Contraseña actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-100"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-100"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-100"
                  placeholder="••••••••"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? "Cambiando..." : "Cambiar contraseña"}
              </button>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Fondo de ventana de chat
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CHAT_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setChatBackground(bg.id)}
                      className={`relative rounded-lg border-2 p-4 transition ${
                        chatBackground === bg.id
                          ? "border-indigo-500 ring-2 ring-indigo-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className={`h-16 rounded-lg bg-gradient-to-br ${bg.color} mb-2`} />
                      <p className="text-sm font-medium text-slate-700">{bg.name}</p>
                      {chatBackground === bg.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSavePreferences}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Guardar preferencias
              </button>
            </div>
          )}

          {/* Notifications Tab - Only for Advisors */}
          {activeTab === "notifications" && isAdvisor && (
            <div className="space-y-6">
              {/* Browser Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-700">Notificaciones del navegador</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Recibe notificaciones incluso cuando la pestaña está en segundo plano
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={browserNotifications}
                    onChange={(e) => setBrowserNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Sound Alerts */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-700">Alertas de sonido</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Reproducir un sonido cuando llegue un nuevo mensaje
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundAlerts}
                    onChange={(e) => setSoundAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Sound Volume */}
              {soundAlerts && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Volumen del sonido: {soundVolume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              )}

              {/* Message Preview */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-700">Vista previa de mensajes</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Mostrar el contenido del mensaje en las notificaciones
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={messagePreview}
                    onChange={(e) => setMessagePreview(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* New Chat Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-700">Notificación por nuevos chats asignados</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Recibe una notificación cuando te asignen un nuevo chat
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChatNotifications}
                    onChange={(e) => setNewChatNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Client Message Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-700">Notificación por mensajes de clientes</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Recibe una notificación cuando un cliente te envíe un mensaje
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientMessageNotifications}
                    onChange={(e) => setClientMessageNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveNotifications}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Guardar configuración
              </button>
            </div>
          )}

          {/* Chat Theme Tab */}
          {activeTab === "chatTheme" && (
            <div className="space-y-6">
              {loadingTheme ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Cargando tema...</p>
                </div>
              ) : (
                <>
                  {/* Header with Reset Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Personaliza tu Chat</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Ajusta colores, fuentes y fondos a tu gusto</p>
                    </div>
                    <button
                      onClick={() => {
                        const defaults = {
                          fontFamily: "system-ui",
                          fontSize: "13px",
                          fontWeight: "400",
                          incomingBubbleBg: "#ffffff",
                          incomingTextColor: "#1e293b",
                          outgoingBubbleBg: "#10b981",
                          outgoingTextColor: "#ffffff",
                          chatBackgroundImage: "",
                          chatBackgroundColor: "",
                        };
                        setChatTheme(defaults);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      🔄 Restaurar por Defecto
                    </button>
                  </div>

                  {/* Preset Themes */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="text-lg">🎨</span> Temas Predefinidos
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => setChatTheme({ ...chatTheme, incomingBubbleBg: "#ffffff", incomingTextColor: "#1e293b", outgoingBubbleBg: "#10b981", outgoingTextColor: "#ffffff", chatBackgroundColor: "" })}
                        className="px-3 py-2 bg-white rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 transition"
                      >
                        WhatsApp
                      </button>
                      <button
                        onClick={() => setChatTheme({ ...chatTheme, incomingBubbleBg: "#2d3748", incomingTextColor: "#e2e8f0", outgoingBubbleBg: "#4a5568", outgoingTextColor: "#f7fafc", chatBackgroundColor: "#1a202c" })}
                        className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 border border-slate-600 transition"
                      >
                        Oscuro
                      </button>
                      <button
                        onClick={() => setChatTheme({ ...chatTheme, incomingBubbleBg: "#f0f9ff", incomingTextColor: "#0c4a6e", outgoingBubbleBg: "#3b82f6", outgoingTextColor: "#ffffff", chatBackgroundColor: "#e0f2fe" })}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 border border-blue-400 transition"
                      >
                        Azul
                      </button>
                      <button
                        onClick={() => setChatTheme({ ...chatTheme, incomingBubbleBg: "#fef3c7", incomingTextColor: "#78350f", outgoingBubbleBg: "#fbbf24", outgoingTextColor: "#ffffff", chatBackgroundColor: "#fffbeb" })}
                        className="px-3 py-2 bg-amber-400 text-white rounded-lg text-xs font-medium hover:bg-amber-500 border border-amber-300 transition"
                      >
                        Dorado
                      </button>
                    </div>
                  </div>

                  {/* Typography Section */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">✍️</span> Tipografía
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Font Family */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">Tipo de Fuente</label>
                        <select
                          value={chatTheme.fontFamily}
                          onChange={(e) => setChatTheme({ ...chatTheme, fontFamily: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          style={{ fontFamily: chatTheme.fontFamily }}
                        >
                          <option value="system-ui" style={{ fontFamily: "system-ui" }}>Sistema</option>
                          <option value="Arial, sans-serif" style={{ fontFamily: "Arial, sans-serif" }}>Arial</option>
                          <option value="'Helvetica Neue', sans-serif" style={{ fontFamily: "'Helvetica Neue', sans-serif" }}>Helvetica</option>
                          <option value="Tahoma, sans-serif" style={{ fontFamily: "Tahoma, sans-serif" }}>Tahoma</option>
                          <option value="Verdana, sans-serif" style={{ fontFamily: "Verdana, sans-serif" }}>Verdana</option>
                          <option value="'Segoe UI', sans-serif" style={{ fontFamily: "'Segoe UI', sans-serif" }}>Segoe UI</option>
                          <option value="'Roboto', sans-serif" style={{ fontFamily: "'Roboto', sans-serif" }}>Roboto</option>
                          <option value="'Open Sans', sans-serif" style={{ fontFamily: "'Open Sans', sans-serif" }}>Open Sans</option>
                          <option value="'Lato', sans-serif" style={{ fontFamily: "'Lato', sans-serif" }}>Lato</option>
                          <option value="'Montserrat', sans-serif" style={{ fontFamily: "'Montserrat', sans-serif" }}>Montserrat</option>
                          <option value="'Poppins', sans-serif" style={{ fontFamily: "'Poppins', sans-serif" }}>Poppins</option>
                          <option value="Georgia, serif" style={{ fontFamily: "Georgia, serif" }}>Georgia</option>
                          <option value="'Times New Roman', serif" style={{ fontFamily: "'Times New Roman', serif" }}>Times New Roman</option>
                          <option value="'Playfair Display', serif" style={{ fontFamily: "'Playfair Display', serif" }}>Playfair Display</option>
                          <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                          <option value="'Comic Sans MS', cursive" style={{ fontFamily: "'Comic Sans MS', cursive" }}>Comic Sans</option>
                          <option value="'Trebuchet MS', sans-serif" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Trebuchet MS</option>
                        </select>
                      </div>

                      {/* Font Weight */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">Grosor de Letra</label>
                        <select
                          value={chatTheme.fontWeight}
                          onChange={(e) => setChatTheme({ ...chatTheme, fontWeight: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="300">Ligera (300)</option>
                          <option value="400">Normal (400)</option>
                          <option value="500">Media (500)</option>
                          <option value="600">Semi-Negrita (600)</option>
                          <option value="700">Negrita (700)</option>
                          <option value="800">Extra-Negrita (800)</option>
                        </select>
                      </div>

                      {/* Font Size */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-2">
                          Tamaño: <span className="font-mono text-indigo-600">{chatTheme.fontSize}</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="10"
                            max="20"
                            value={parseInt(chatTheme.fontSize)}
                            onChange={(e) => setChatTheme({ ...chatTheme, fontSize: `${e.target.value}px` })}
                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex gap-1">
                            {["11px", "13px", "15px", "18px"].map(size => (
                              <button
                                key={size}
                                onClick={() => setChatTheme({ ...chatTheme, fontSize: size })}
                                className={`px-2 py-1 text-xs rounded ${chatTheme.fontSize === size ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Colors Section */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">🎨</span> Colores de Burbujas
                    </h4>
                    <div className="space-y-4">
                      {/* Incoming Bubble */}
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-bold text-slate-700 mb-3">📩 Mensajes Entrantes (Cliente)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-2">Fondo</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={chatTheme.incomingBubbleBg}
                                onChange={(e) => setChatTheme({ ...chatTheme, incomingBubbleBg: e.target.value })}
                                className="w-12 h-10 border-2 border-slate-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={chatTheme.incomingBubbleBg}
                                onChange={(e) => setChatTheme({ ...chatTheme, incomingBubbleBg: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-2">Texto</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={chatTheme.incomingTextColor}
                                onChange={(e) => setChatTheme({ ...chatTheme, incomingTextColor: e.target.value })}
                                className="w-12 h-10 border-2 border-slate-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={chatTheme.incomingTextColor}
                                onChange={(e) => setChatTheme({ ...chatTheme, incomingTextColor: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Outgoing Bubble */}
                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-xs font-bold text-slate-700 mb-3">📤 Mensajes Salientes (Tú)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-2">Fondo</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={chatTheme.outgoingBubbleBg}
                                onChange={(e) => setChatTheme({ ...chatTheme, outgoingBubbleBg: e.target.value })}
                                className="w-12 h-10 border-2 border-slate-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={chatTheme.outgoingBubbleBg}
                                onChange={(e) => setChatTheme({ ...chatTheme, outgoingBubbleBg: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-2">Texto</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={chatTheme.outgoingTextColor}
                                onChange={(e) => setChatTheme({ ...chatTheme, outgoingTextColor: e.target.value })}
                                className="w-12 h-10 border-2 border-slate-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={chatTheme.outgoingTextColor}
                                onChange={(e) => setChatTheme({ ...chatTheme, outgoingTextColor: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background Section */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">🖼️</span> Fondo del Chat
                    </h4>
                    <div className="space-y-4">
                      {/* Background Color */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Color de Fondo</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={chatTheme.chatBackgroundColor}
                            onChange={(e) => setChatTheme({ ...chatTheme, chatBackgroundColor: e.target.value })}
                            className="w-12 h-10 border-2 border-slate-300 rounded-lg cursor-pointer"
                          />
                          <input
                            type="text"
                            value={chatTheme.chatBackgroundColor}
                            onChange={(e) => setChatTheme({ ...chatTheme, chatBackgroundColor: e.target.value })}
                            className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Background Image Upload */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Imagen de Fondo (opcional)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > 5 * 1024 * 1024) {
                                setMessage({ type: "error", text: "La imagen no debe superar 5MB" });
                                return;
                              }

                              setUploadingBackground(true);
                              try {
                                const formData = new FormData();
                                formData.append("background", file);

                                const response = await fetch(apiUrl("/api/user-profile/chat-background"), {
                                  method: "POST",
                                  credentials: "include",
                                  body: formData,
                                });

                                if (response.ok) {
                                  const data = await response.json();
                                  setChatTheme({ ...chatTheme, chatBackgroundImage: data.backgroundUrl });
                                  setMessage({ type: "success", text: "Imagen de fondo subida correctamente" });
                                } else {
                                  setMessage({ type: "error", text: "Error al subir la imagen" });
                                }
                              } catch (error) {
                                console.error("Error uploading background:", error);
                                setMessage({ type: "error", text: "Error al subir la imagen" });
                              } finally {
                                setUploadingBackground(false);
                              }
                            }}
                            className="flex-1 text-xs border border-slate-300 rounded-lg file:mr-3 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium hover:file:bg-indigo-100 cursor-pointer"
                          />
                          {chatTheme.chatBackgroundImage && (
                            <button
                              onClick={() => setChatTheme({ ...chatTheme, chatBackgroundImage: "" })}
                              className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        {uploadingBackground && <p className="text-xs text-indigo-600 mt-2">Subiendo imagen...</p>}
                        {chatTheme.chatBackgroundImage && (
                          <div className="mt-2">
                            <img src={chatTheme.chatBackgroundImage} alt="Fondo" className="w-24 h-24 object-cover rounded border border-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-5 border-2 border-slate-300 shadow-lg">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="text-lg">👀</span> Vista Previa en Vivo
                    </h4>
                    <div
                      className="relative space-y-3 p-4 rounded-lg overflow-hidden min-h-[200px]"
                      style={{
                        backgroundColor: chatTheme.chatBackgroundColor,
                        backgroundImage: chatTheme.chatBackgroundImage ? `url(${chatTheme.chatBackgroundImage})` : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {/* Incoming message */}
                      <div className="flex justify-start">
                        <div
                          className="max-w-xs rounded-2xl px-4 py-2.5 shadow-md"
                          style={{
                            backgroundColor: chatTheme.incomingBubbleBg,
                            color: chatTheme.incomingTextColor,
                            fontFamily: chatTheme.fontFamily,
                            fontSize: chatTheme.fontSize,
                            fontWeight: chatTheme.fontWeight,
                          }}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            ¡Hola! Necesito ayuda con mi pedido 😊
                          </p>
                          <span className="text-[10px] opacity-70 mt-1 block">Cliente • 10:30</span>
                        </div>
                      </div>

                      {/* Outgoing message */}
                      <div className="flex justify-end">
                        <div
                          className="max-w-xs rounded-2xl px-4 py-2.5 shadow-md"
                          style={{
                            backgroundColor: chatTheme.outgoingBubbleBg,
                            color: chatTheme.outgoingTextColor,
                            fontFamily: chatTheme.fontFamily,
                            fontSize: chatTheme.fontSize,
                            fontWeight: chatTheme.fontWeight,
                          }}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            ¡Por supuesto! Con gusto te ayudo 👍
                          </p>
                          <span className="text-[10px] opacity-70 mt-1 block text-right">Tú • 10:31 ✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveChatTheme}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3.5 text-sm font-bold text-white hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "💾 Guardando..." : "💾 Guardar Tema Personalizado"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
