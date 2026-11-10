import { escapeHtml, isSupabaseConfigured, signImageUrls, supabase } from "./supabase.js";
import { extractPropertyVideo, parsePropertyVideoUrl, setPropertyVideo } from "./video.js";
import { getOlxPropertyIssues } from "./olx-xml.mjs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_PHOTOS = 20;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const FILE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};
const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  headerActions: document.querySelector("#adminHeaderActions"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  togglePasswordVisibility: document.querySelector("#togglePasswordVisibility"),
  loginFeedback: document.querySelector("#loginFeedback"),
  signOutButton: document.querySelector("#signOutButton"),
  feedback: document.querySelector("#adminFeedback"),
  newButton: document.querySelector("#newPropertyButton"),
  editor: document.querySelector("#propertyEditor"),
  editorTitle: document.querySelector("#editorTitle"),
  closeEditor: document.querySelector("#closeEditorButton"),
  cancelEditor: document.querySelector("#cancelEditorButton"),
  form: document.querySelector("#propertyForm"),
  photoInput: document.querySelector("#photoInput"),
  photoPreviews: document.querySelector("#photoPreviews"),
  list: document.querySelector("#propertyList"),
  empty: document.querySelector("#adminEmpty"),
  total: document.querySelector("#totalCount"),
  published: document.querySelector("#publishedCount"),
  drafts: document.querySelector("#draftCount"),
  listCount: document.querySelector("#listCount"),
  saveButton: document.querySelector("#savePropertyButton"),
  olxFeedStatus: document.querySelector("#olxFeedStatus"),
  olxFeedUrl: document.querySelector("#olxFeedUrl"),
  copyOlxFeedButton: document.querySelector("#copyOlxFeedButton"),
  testOlxFeedButton: document.querySelector("#testOlxFeedButton"),
  olxPendingSummary: document.querySelector("#olxPendingSummary")
};
let properties = [];
let existingPhotos = [];
let removedPhotos = [];
let selectedPhotos = [];
let primaryImageKey = "";
let feedbackTimeout;
let loginSubmitting = false;

function showFeedback(message, kind = "info", duration = 6000) {
  window.clearTimeout(feedbackTimeout);
  elements.feedback.textContent = message;
  elements.feedback.dataset.kind = kind;
  if (duration) {
    feedbackTimeout = window.setTimeout(() => {
      elements.feedback.textContent = "";
      delete elements.feedback.dataset.kind;
    }, duration);
  }
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.textContent = label;
}

function loginErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials") || message.includes("invalid email or password")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Não foi possível conectar ao serviço de login. Verifique sua conexão e tente novamente.";
  }
  return "Não foi possível entrar no painel. Tente novamente em instantes.";
}

function revokeSelectedPreviews() {
  selectedPhotos.forEach(({ preview }) => URL.revokeObjectURL(preview));
  selectedPhotos = [];
}

function renderPhotoPreviews() {
  const existing = existingPhotos.map((photo) => `
    <article class="admin-photo-item${primaryImageKey === photo.id ? " is-primary" : ""}">
      <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt_text || "Foto do imóvel")}" loading="lazy">
      <span>${escapeHtml(photo.fileName || "Fotografia cadastrada")}</span>
      <label class="admin-primary-choice"><input type="radio" name="primaryPhoto" value="${escapeHtml(photo.id)}"${primaryImageKey === photo.id ? " checked" : ""}> Imagem principal</label>
      <button type="button" data-remove-existing="${escapeHtml(photo.id)}" aria-label="Remover fotografia cadastrada">×</button>
    </article>`).join("");
  const selected = selectedPhotos.map((photo, index) => `
    <article class="admin-photo-item${primaryImageKey === photo.key ? " is-primary" : ""}">
      <img src="${escapeHtml(photo.preview)}" alt="${escapeHtml(photo.file.name)}">
      <span>${escapeHtml(photo.file.name)}</span>
      <label class="admin-primary-choice"><input type="radio" name="primaryPhoto" value="${escapeHtml(photo.key)}"${primaryImageKey === photo.key ? " checked" : ""}> Imagem principal</label>
      <button type="button" data-remove-selected="${index}" aria-label="Remover ${escapeHtml(photo.file.name)}">×</button>
    </article>`).join("");
  elements.photoPreviews.innerHTML = existing + selected;
}

function setEditorOpen(open) {
  elements.editor.hidden = !open;
  if (open) elements.editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  elements.form.reset();
  elements.form.elements.id.value = "";
  elements.form.elements.bedrooms.value = "0";
  elements.form.elements.suites.value = "0";
  elements.form.elements.bathrooms.value = "0";
  elements.form.elements.parking.value = "0";
  elements.form.elements.status.value = "draft";
  elements.form.elements.video_url.setCustomValidity("");
  elements.photoInput.value = "";
  existingPhotos = [];
  removedPhotos = [];
  primaryImageKey = "";
  revokeSelectedPreviews();
  renderPhotoPreviews();
}

function openNewProperty() {
  resetEditor();
  elements.editorTitle.textContent = "Cadastrar imóvel";
  elements.saveButton.textContent = "Salvar imóvel";
  setEditorOpen(true);
  elements.form.elements.title.focus({ preventScroll: true });
}

function propertyPayload(formData) {
  const numberOrNull = (field) => formData.get(field) === "" ? null : Number(formData.get(field));
  const integerOrZero = (field) => Number(formData.get(field) || 0);
  const features = String(formData.get("features") || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  return {
    title: String(formData.get("title")).trim(),
    reference: String(formData.get("reference") || "").trim() || null,
    property_type: String(formData.get("property_type")),
    purpose: String(formData.get("purpose")),
    price: Number(formData.get("price")),
    condominium: numberOrNull("condominium"),
    iptu: numberOrNull("iptu"),
    city: String(formData.get("city")).trim(),
    neighborhood: String(formData.get("neighborhood")).trim(),
    cep: String(formData.get("cep") || "").replace(/\D/g, "") || null,
    address: String(formData.get("address") || "").trim() || null,
    bedrooms: integerOrZero("bedrooms"),
    suites: integerOrZero("suites"),
    bathrooms: integerOrZero("bathrooms"),
    parking: integerOrZero("parking"),
    total_area: numberOrNull("total_area"),
    built_area: numberOrNull("built_area"),
    description: String(formData.get("description") || "").trim(),
    features: setPropertyVideo(features, formData.get("video_url")),
    featured: formData.get("featured") === "on",
    updated_at: new Date().toISOString()
  };
}

function validatePhotos() {
  if (existingPhotos.length + selectedPhotos.length > MAX_PHOTOS) {
    throw new Error(`O imóvel pode ter no máximo ${MAX_PHOTOS} fotografias.`);
  }
  selectedPhotos.forEach(({ file }) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`Formato não permitido: ${file.name}. Use JPG, PNG, WebP ou AVIF.`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`A imagem ${file.name} excede o limite de 8 MB.`);
    }
  });
}

async function uploadSelectedPhotos(propertyId) {
  const uploaded = [];
  for (const { file } of selectedPhotos) {
    const path = `${propertyId}/${crypto.randomUUID()}.${FILE_EXTENSIONS[file.type]}`;
    const { error } = await supabase.storage
      .from("property-photos")
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (error) {
      const cleanup = uploaded.length
        ? await supabase.storage.from("property-photos").remove(uploaded.map((photo) => photo.storage_path))
        : { error: null };
      const cleanupMessage = cleanup.error ? ` Também não foi possível limpar os uploads incompletos: ${cleanup.error.message}` : "";
      throw new Error(`Falha ao enviar ${file.name}: ${error.message}.${cleanupMessage}`);
    }
    uploaded.push({ key: selectedPhotos[uploaded.length].key, property_id: propertyId, storage_path: path, alt_text: file.name, display_order: existingPhotos.length + uploaded.length, is_primary: false });
  }
  return uploaded;
}

async function saveProperty(event) {
  event.preventDefault();
  const videoField = elements.form.elements.video_url;
  const videoValue = videoField.value.trim();
  const validVideo = !videoValue || parsePropertyVideoUrl(videoValue);
  videoField.setCustomValidity(validVideo ? "" : "Use um link válido do YouTube ou de um Instagram Reels público.");
  if (!validVideo) {
    showFeedback(videoField.validationMessage, "error", 0);
    videoField.reportValidity();
    return;
  }
  if (!elements.form.reportValidity()) return;

  let uploadedPhotos = [];
  let newPrimaryImageId = "";
  setBusy(elements.saveButton, true, "Salvando…");
  try {
    validatePhotos();
    const formData = new FormData(elements.form);
    const id = String(formData.get("id") || "");
    const payload = propertyPayload(formData);
    const desiredStatus = String(formData.get("status"));
    let propertyId = id;

    if (id) {
      const { error } = await supabase.from("properties").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("properties")
        .insert({ ...payload, status: "draft" })
        .select("id")
        .single();
      if (error) throw error;
      propertyId = data.id;
      elements.form.elements.id.value = propertyId;
      elements.editorTitle.textContent = "Editar imóvel";
    }

    uploadedPhotos = await uploadSelectedPhotos(propertyId);

    if (uploadedPhotos.length) {
      const { data: insertedImages, error } = await supabase
        .from("property_images")
        .insert(uploadedPhotos.map(({ key, ...image }) => image))
        .select("id, storage_path");
      if (error) throw new Error(`Falha ao associar as fotografias ao imóvel: ${error.message}`);
      const selectedNewImage = insertedImages.find((image) =>
        uploadedPhotos.find((upload) => upload.storage_path === image.storage_path)?.key === primaryImageKey);
      if (selectedNewImage) newPrimaryImageId = selectedNewImage.id;
      uploadedPhotos = [];
    }

    if (removedPhotos.length) {
      const { error: deleteError } = await supabase.from("property_images").delete().in("id", removedPhotos.map((photo) => photo.id));
      if (deleteError) throw deleteError;
      const { error } = await supabase.storage.from("property-photos").remove(removedPhotos.map((photo) => photo.storage_path));
      if (error) throw new Error(`Imóvel salvo, mas não foi possível excluir algumas fotografias antigas: ${error.message}`);
    }

    const selectedPrimaryImageId = newPrimaryImageId || (
      existingPhotos.some((photo) => photo.id === primaryImageKey) ? primaryImageKey : ""
    );
    if (selectedPrimaryImageId) {
      const { error } = await supabase.rpc("set_primary_property_image", { p_image_id: selectedPrimaryImageId });
      if (error) throw new Error(`Imóvel salvo, mas não foi possível definir a imagem principal: ${error.message}`);
    }

    const { error: statusError } = await supabase
      .from("properties")
      .update({ status: desiredStatus, updated_at: new Date().toISOString() })
      .eq("id", propertyId);
    if (statusError) throw statusError;

    showFeedback("Imóvel salvo com sucesso.", "success");
    resetEditor();
    setEditorOpen(false);
    await loadProperties();
  } catch (error) {
    if (uploadedPhotos.length) {
      const { error: cleanupError } = await supabase.storage
        .from("property-photos")
        .remove(uploadedPhotos.map((photo) => photo.storage_path));
      if (cleanupError) {
        showFeedback(`${error.message} Não foi possível limpar os arquivos enviados: ${cleanupError.message}`, "error", 0);
      } else {
        showFeedback(error.message || "Não foi possível salvar o imóvel.", "error", 0);
      }
    } else {
      showFeedback(error.message || "Não foi possível salvar o imóvel.", "error", 0);
    }
  } finally {
    setBusy(elements.saveButton, false, "Salvar imóvel");
    if (elements.form.elements.id.value) elements.saveButton.textContent = "Salvar alterações";
  }
}

async function openEditProperty(id) {
  const property = properties.find((item) => item.id === id);
  if (!property) {
    showFeedback("Este imóvel não está mais disponível para edição.", "error");
    return;
  }
  resetEditor();
  elements.editorTitle.textContent = "Editar imóvel";
  elements.saveButton.textContent = "Salvar alterações";
  const fields = elements.form.elements;
  const propertyVideo = extractPropertyVideo(property.features);
  for (const field of Array.from(fields)) {
    if (!field.name || (field.name !== "video_url" && !Object.hasOwn(property, field.name))) continue;
    if (field.name === "features") field.value = propertyVideo.features.join("\n");
    else if (field.name === "video_url") field.value = propertyVideo.video?.url || "";
    else if (field.type === "checkbox") field.checked = Boolean(property[field.name]);
    else if (field.name !== "photos" && field.name !== "id") field.value = property[field.name] ?? "";
  }
  fields.id.value = property.id;
  try {
    existingPhotos = await signImageUrls(property.property_images || []);
    existingPhotos = existingPhotos.map((photo, index) => ({
      ...photo,
      fileName: photo.storage_path.split("/").pop(),
      display_order: index
    }));
    primaryImageKey = existingPhotos.find((photo) => photo.is_primary)?.id || existingPhotos[0]?.id || "";
    renderPhotoPreviews();
    setEditorOpen(true);
    fields.title.focus({ preventScroll: true });
  } catch (error) {
    showFeedback(`Não foi possível carregar as fotografias: ${error.message}`, "error", 0);
  }
}

function renderProperties() {
  elements.total.textContent = String(properties.length);
  elements.published.textContent = String(properties.filter((property) => property.status === "published").length);
  elements.drafts.textContent = String(properties.filter((property) => property.status === "draft").length);
  elements.listCount.textContent = `${properties.length} ${properties.length === 1 ? "imóvel" : "imóveis"}`;
  elements.empty.hidden = properties.length !== 0;
  elements.list.innerHTML = properties.map((property) => {
    const image = property.property_images?.find((photo) => photo.is_primary) || property.property_images?.[0];
    const signed = property.signedImages?.find((photo) => photo.id === image?.id);
    const location = [property.neighborhood, property.city].filter(Boolean).join(", ");
    const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(property.price);
    const status = property.status === "published" ? "Publicado" : "Rascunho";
    const nextStatus = property.status === "published" ? "Despublicar" : "Publicar";
    return `
      <article class="admin-property-row">
        ${signed ? `<img class="admin-property-thumb" src="${escapeHtml(signed.src)}" alt="" loading="lazy">` : '<div class="admin-property-thumb" aria-hidden="true"></div>'}
        <div class="admin-property-info">
          <strong>${escapeHtml(property.title)}</strong>
          <span>${escapeHtml(location)} · ${price}${property.reference ? ` · Ref. ${escapeHtml(property.reference)}` : ""}</span>
          <span class="admin-status admin-status-${escapeHtml(property.status)}">${status}</span>
        </div>
        <div class="admin-property-actions">
          <button class="admin-button admin-button-quiet" type="button" data-edit="${escapeHtml(property.id)}">Editar</button>
          <button class="admin-button admin-button-quiet" type="button" data-toggle="${escapeHtml(property.id)}">${nextStatus}</button>
          <button class="admin-button admin-button-danger" type="button" data-delete="${escapeHtml(property.id)}">Excluir</button>
        </div>
      </article>`;
  }).join("");
  renderOlxSummary();
}

function renderOlxSummary() {
  const publishedProperties = properties.filter((property) => property.status === "published");
  const pending = publishedProperties
    .map((property) => getOlxPropertyIssues(property))
    .filter((issues) => issues.length > 0);

  if (!pending.length) {
    elements.olxPendingSummary.textContent = publishedProperties.length
      ? `${publishedProperties.length} imóvel(is) publicado(s) com os campos obrigatórios preenchidos.`
      : "Nenhum imóvel publicado para exportar.";
    return;
  }

  const reasons = new Map();
  pending.flat().forEach((issue) => reasons.set(issue, (reasons.get(issue) || 0) + 1));
  const details = Array.from(reasons, ([issue, count]) => `${issue} (${count})`).join("; ");
  elements.olxPendingSummary.textContent =
    `${pending.length} imóvel(is) publicado(s) não entram no XML até corrigir: ${details}.`;
}

async function checkOlxFeed() {
  elements.olxFeedStatus.textContent = "Verificando endpoint público…";
  delete elements.olxFeedStatus.dataset.state;
  try {
    const response = await fetch(elements.olxFeedUrl.value, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/xml" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror") || xml.documentElement.localName !== "Carga"
      || !xml.querySelector("Carga > Imoveis")) {
      throw new Error("a resposta não contém o XML esperado pela OLX");
    }
    const count = xml.querySelectorAll("Carga > Imoveis > Imovel").length;
    elements.olxFeedStatus.textContent = `Endpoint público acessível · ${count} anúncio(s) no XML.`;
    elements.olxFeedStatus.dataset.state = "success";
  } catch (error) {
    elements.olxFeedStatus.textContent = `Endpoint ainda não validado: ${error.message}. Publique a versão atual no Vercel e teste novamente.`;
    elements.olxFeedStatus.dataset.state = "error";
  }
}

async function validateImageFile(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const signature = (start, value) => String.fromCharCode(...bytes.slice(start, start + value.length)) === value;
  const validSignature = {
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/png": signature(0, "\x89PNG\r\n\x1a\n"),
    "image/webp": signature(0, "RIFF") && signature(8, "WEBP"),
    "image/avif": signature(4, "ftyp") && (signature(8, "avif") || signature(8, "avis") || signature(8, "mif1"))
  }[file.type];
  if (!validSignature) throw new Error(`O arquivo ${file.name} não contém uma imagem ${file.type.replace("image/", "").toUpperCase()} válida.`);
}

async function loadProperties() {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(*)")
      .order("created_at", { ascending: false })
      .order("display_order", { referencedTable: "property_images", ascending: true });
    if (error) throw error;

    properties = await Promise.all(data.map(async (property) => ({
      ...property,
      signedImages: await signImageUrls(property.property_images || [])
    })));
    renderProperties();
  } catch (error) {
    showFeedback(`Falha ao carregar os imóveis: ${error.message}`, "error", 0);
  }
}

async function togglePublished(id) {
  const property = properties.find((item) => item.id === id);
  if (!property) return;
  try {
    const status = property.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("properties")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    showFeedback(status === "published" ? "Imóvel publicado." : "Imóvel despublicado.", "success");
    await loadProperties();
  } catch (error) {
    showFeedback(`Não foi possível alterar a publicação: ${error.message}`, "error", 0);
  }
}

async function deleteProperty(id) {
  const property = properties.find((item) => item.id === id);
  if (!property) return;
  if (!window.confirm(`Excluir “${property.title}”? Esta ação não pode ser desfeita.`)) return;

  try {
    const paths = (property.property_images || []).map((image) => image.storage_path);
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("property-photos").remove(paths);
      if (storageError) {
        showFeedback(`Imóvel excluído, mas falhou a limpeza das fotografias: ${storageError.message}`, "error", 0);
        await loadProperties();
        return;
      }
    }
    showFeedback("Imóvel excluído.", "success");
    await loadProperties();
  } catch (error) {
    showFeedback(`Não foi possível excluir o imóvel: ${error.message}`, "error", 0);
  }
}

async function verifyAdmin(session) {
  if (!session) {
    elements.dashboardPanel.hidden = true;
    elements.headerActions.hidden = true;
    elements.loginPanel.hidden = false;
    return false;
  }
  try {
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      showFeedback("Esta conta não tem permissão para administrar os imóveis.", "error", 0);
      return false;
    }
    elements.loginPanel.hidden = true;
    elements.dashboardPanel.hidden = false;
    elements.headerActions.hidden = false;
    await loadProperties();
    await checkOlxFeed();
    return true;
  } catch (error) {
    await supabase.auth.signOut();
    elements.dashboardPanel.hidden = true;
    elements.headerActions.hidden = true;
    elements.loginPanel.hidden = false;
    showFeedback(`Não foi possível verificar as permissões administrativas: ${error.message}`, "error", 0);
    return false;
  }
}

function initializePhotoPicker() {
  elements.photoInput.addEventListener("change", async () => {
    const newFiles = Array.from(elements.photoInput.files || []);
    const invalidFile = newFiles.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);
    if (invalidFile) {
      elements.photoInput.value = "";
      showFeedback(`Arquivo inválido ou maior que 8 MB: ${invalidFile.name}.`, "error");
      return;
    }
    if (existingPhotos.length + selectedPhotos.length + newFiles.length > MAX_PHOTOS) {
      elements.photoInput.value = "";
      showFeedback(`O imóvel pode ter no máximo ${MAX_PHOTOS} fotografias.`, "error");
      return;
    }
    try {
      for (const file of newFiles) await validateImageFile(file);
    } catch (error) {
      elements.photoInput.value = "";
      showFeedback(error.message, "error");
      return;
    }
    newFiles.forEach((file) => {
      const photo = { key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) };
      selectedPhotos.push(photo);
      if (!primaryImageKey) primaryImageKey = photo.key;
    });
    elements.photoInput.value = "";
    renderPhotoPreviews();
  });

  elements.photoPreviews.addEventListener("click", (event) => {
    const removeExisting = event.target.closest("[data-remove-existing]");
    if (removeExisting) {
      const photo = existingPhotos.find((item) => item.id === removeExisting.dataset.removeExisting);
      if (photo) removedPhotos.push(photo);
      existingPhotos = existingPhotos.filter((item) => item.id !== removeExisting.dataset.removeExisting);
      if (primaryImageKey === removeExisting.dataset.removeExisting) {
        primaryImageKey = existingPhotos[0]?.id || selectedPhotos[0]?.key || "";
      }
      renderPhotoPreviews();
      return;
    }
    const removeSelected = event.target.closest("[data-remove-selected]");
    if (!removeSelected) return;
    const [photo] = selectedPhotos.splice(Number(removeSelected.dataset.removeSelected), 1);
    if (photo) URL.revokeObjectURL(photo.preview);
    if (photo?.key === primaryImageKey) primaryImageKey = existingPhotos[0]?.id || selectedPhotos[0]?.key || "";
    renderPhotoPreviews();
  });
  elements.photoPreviews.addEventListener("change", (event) => {
    const primaryChoice = event.target.closest('input[name="primaryPhoto"]');
    if (!primaryChoice) return;
    primaryImageKey = primaryChoice.value;
    renderPhotoPreviews();
  });
}

async function initializeAdmin() {
  elements.olxFeedUrl.value = `${window.location.origin}/api/integracao/olx.xml`;
  elements.copyOlxFeedButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.olxFeedUrl.value);
      showFeedback("Endereço do XML copiado.", "success");
    } catch (error) {
      showFeedback(`Não foi possível copiar o endereço: ${error.message}`, "error");
    }
  });
  elements.testOlxFeedButton.addEventListener("click", checkOlxFeed);

  elements.togglePasswordVisibility.addEventListener("click", () => {
    const showPassword = elements.loginPassword.type === "password";
    elements.loginPassword.type = showPassword ? "text" : "password";
    elements.togglePasswordVisibility.setAttribute("aria-label", showPassword ? "Ocultar senha" : "Mostrar senha");
    elements.togglePasswordVisibility.setAttribute("aria-pressed", String(showPassword));
    elements.togglePasswordVisibility.querySelector("[data-eye-open]").hidden = showPassword;
    elements.togglePasswordVisibility.querySelector("[data-eye-closed]").hidden = !showPassword;
  });

  if (!isSupabaseConfigured) {
    elements.loginPanel.hidden = false;
    elements.loginForm.querySelector("button[type=submit]").disabled = true;
    showFeedback("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para habilitar o painel.", "error", 0);
    return;
  }

  initializePhotoPicker();
  elements.newButton.addEventListener("click", openNewProperty);
  elements.closeEditor.addEventListener("click", () => {
    resetEditor();
    setEditorOpen(false);
  });
  elements.cancelEditor.addEventListener("click", () => {
    resetEditor();
    setEditorOpen(false);
  });
  elements.form.addEventListener("submit", saveProperty);
  elements.form.elements.video_url.addEventListener("input", (event) => {
    const field = event.currentTarget;
    const value = field.value.trim();
    field.setCustomValidity(!value || parsePropertyVideoUrl(value)
      ? ""
      : "Use um link válido do YouTube ou de um Instagram Reels público.");
  });
  elements.list.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit]");
    const toggle = event.target.closest("[data-toggle]");
    const remove = event.target.closest("[data-delete]");
    if (edit) await openEditProperty(edit.dataset.edit);
    else if (toggle) await togglePublished(toggle.dataset.toggle);
    else if (remove) await deleteProperty(remove.dataset.delete);
  });
  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (loginSubmitting) return;
    loginSubmitting = true;
    const button = elements.loginForm.querySelector("button[type=submit]");
    elements.loginFeedback.hidden = true;
    elements.loginFeedback.textContent = "";
    setBusy(button, true, "Entrando…");
    try {
      const formData = new FormData(elements.loginForm);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email")).trim(),
        password: String(formData.get("password"))
      });
      if (error) {
        elements.loginFeedback.textContent = loginErrorMessage(error);
        elements.loginFeedback.hidden = false;
      } else {
        await verifyAdmin(data.session);
      }
    } catch (error) {
      elements.loginFeedback.textContent = loginErrorMessage(error);
      elements.loginFeedback.hidden = false;
    } finally {
      loginSubmitting = false;
      setBusy(button, false, "Entrar");
    }
  });
  elements.signOutButton.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      resetEditor();
      setEditorOpen(false);
      elements.dashboardPanel.hidden = true;
      elements.headerActions.hidden = true;
      elements.loginPanel.hidden = false;
      showFeedback("Sessão encerrada.", "success");
    } catch (error) {
      showFeedback(`Não foi possível sair: ${error.message}`, "error", 0);
    }
  });

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      resetEditor();
      setEditorOpen(false);
      elements.dashboardPanel.hidden = true;
      elements.headerActions.hidden = true;
      elements.loginPanel.hidden = false;
    }
  });

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await verifyAdmin(data.session);
  } catch (error) {
    showFeedback(`Não foi possível verificar a sessão: ${error.message}`, "error", 0);
  }
}

initializeAdmin();
