export type DistributorLanguage = "pt" | "es" | "en";

export function distributorLanguage(value?: string | null): DistributorLanguage {
  return value === "en" || value === "es" ? value : "pt";
}

const translations: Record<string, [string, string]> = {
  "Idioma / Language / Idioma": [
    "Idioma",
    "Language"
  ],
  "Moeda corrente / Currency / Moneda": [
    "Moneda",
    "Currency"
  ],
  "Identificação": [
    "Identificación",
    "Identification"
  ],
  "Logo da empresa": [
    "Logotipo de la empresa",
    "Company logo"
  ],
  "Remover logo": [
    "Eliminar logotipo",
    "Remove logo"
  ],
  "Enviando…": [
    "Enviando…",
    "Sending…"
  ],
  "Enviar logo": [
    "Subir logotipo",
    "Upload logo"
  ],
  "PNG, JPG, WebP ou SVG — máx 5MB": [
    "PNG, JPG, WebP o SVG — máx. 5MB",
    "PNG, JPG, WebP or SVG — max 5MB"
  ],
  "Razão Social *": [
    "Razón social *",
    "Legal company name *"
  ],
  "Nome Fantasia": [
    "Nombre comercial",
    "Trading name"
  ],
  "Localização": [
    "Ubicación",
    "Location"
  ],
  "País": [
    "País",
    "Country"
  ],
  "Selecione o país": [
    "Seleccione el país",
    "Select country"
  ],
  "Nenhum país encontrado": [
    "No se encontraron países",
    "No countries found"
  ],
  "Estado / Província": [
    "Estado / Provincia",
    "State / Province"
  ],
  "Selecione": [
    "Seleccione",
    "Select"
  ],
  "Nenhum estado encontrado": [
    "No se encontraron estados",
    "No states found"
  ],
  "Cidade": [
    "Ciudad",
    "City"
  ],
  "Nenhuma cidade encontrada": [
    "No se encontraron ciudades",
    "No cities found"
  ],
  "Digite a cidade": [
    "Escriba la ciudad",
    "Enter city"
  ],
  "Endereço Completo": [
    "Dirección completa",
    "Full address"
  ],
  "CEP / Código Postal": [
    "Código postal",
    "Postal code"
  ],
  "Número de Unidades / Filiais": [
    "Número de unidades / sucursales",
    "Number of locations / branches"
  ],
  "Presença Digital": [
    "Presencia digital",
    "Digital presence"
  ],
  "Site Oficial (URL)": [
    "Sitio web oficial (URL)",
    "Official website (URL)"
  ],
  "@ ou URL": [
    "@ o URL",
    "@ or URL"
  ],
  "LinkedIn da empresa": [
    "LinkedIn de la empresa",
    "Company LinkedIn"
  ],
  "Canal YouTube": [
    "Canal de YouTube",
    "YouTube channel"
  ],
  "Contato — Proprietário / Diretor": [
    "Contacto — Propietario / Director",
    "Contact — Owner / Director"
  ],
  "Contato — Responsável de Compras": [
    "Contacto — Responsable de compras",
    "Contact — Purchasing manager"
  ],
  "Nome": [
    "Nombre",
    "Name"
  ],
  "E-mail": [
    "Correo electrónico",
    "Email"
  ],
  "Número": [
    "Número",
    "Number"
  ],
  "Observações": [
    "Observaciones",
    "Notes"
  ],
  "Qual linha de produto você quer mais informações?": [
    "¿Sobre qué línea de productos desea más información?",
    "Which product line would you like more information about?"
  ],
  "Selecionar tudo": [
    "Seleccionar todo",
    "Select all"
  ],
  "Limpar": [
    "Limpiar",
    "Clear"
  ],
  "Nenhuma subcategoria marcada = autoriza todas as subcategorias desta categoria.": [
    "Sin subcategorías seleccionadas = todas las subcategorías de esta categoría.",
    "No subcategories selected = all subcategories in this category."
  ],
  "Sem subcategorias cadastradas.": [
    "No hay subcategorías registradas.",
    "No subcategories registered."
  ],
  "Buscar…": [
    "Buscar…",
    "Search…"
  ],
  "Logo deve ter no máximo 5MB": [
    "El logotipo debe tener un máximo de 5MB",
    "Logo must be no larger than 5MB"
  ],
  "Erro no upload: ": [
    "Error al subir: ",
    "Upload error: "
  ],
  "Logo enviado": [
    "Logotipo subido",
    "Logo uploaded"
  ],
  "Cadastro de Distribuidor Credenciado": [
    "Registro de distribuidor acreditado",
    "Accredited distributor registration"
  ],
  "Razão Social é obrigatória": [
    "La razón social es obligatoria",
    "Legal company name is required"
  ],
  "Erro ao cadastrar: ": [
    "Error al registrar: ",
    "Registration error: "
  ],
  "tente novamente": [
    "inténtelo de nuevo",
    "please try again"
  ],
  "Distribuidor cadastrado!": [
    "¡Distribuidor registrado!",
    "Distributor registered!"
  ],
  "Recebemos o cadastro. Nossa equipe entrará em contato em breve.": [
    "Hemos recibido su registro. Nuestro equipo se pondrá en contacto pronto.",
    "We have received your registration. Our team will contact you soon."
  ],
  "Cadastrar outro distribuidor": [
    "Registrar otro distribuidor",
    "Register another distributor"
  ],
  "Preencha os dados da empresa que está sendo credenciada como distribuidora SmartDent.": [
    "Complete los datos de la empresa que solicita acreditarse como distribuidora SmartDent.",
    "Enter the details of the company applying to become a SmartDent distributor."
  ],
  "Campos com": [
    "Los campos con",
    "Fields marked with"
  ],
  "são obrigatórios.": [
    "son obligatorios.",
    "are required."
  ],
  "Enviar cadastro": [
    "Enviar registro",
    "Submit registration"
  ],
  "© SmartDent · Cadastro oficial de distribuidores": [
    "© SmartDent · Registro oficial de distribuidores",
    "© SmartDent · Official distributor registration"
  ],
  "SCANNERS 3D": [
    "ESCÁNERES 3D",
    "3D SCANNERS"
  ],
  "RESINAS 3D": [
    "RESINAS 3D",
    "3D RESINS"
  ],
  "IMPRESSÃO 3D": [
    "IMPRESIÓN 3D",
    "3D PRINTING"
  ],
  "PÓS-IMPRESSÃO": [
    "POSIMPRESIÓN",
    "POST-PRINTING"
  ],
  "CARACTERIZAÇÃO": [
    "CARACTERIZACIÓN",
    "CHARACTERIZATION"
  ],
  "DENTÍSTICA, ESTÉTICA E ORTODONTIA": [
    "ODONTOLOGÍA RESTAURADORA, ESTÉTICA Y ORTODONCIA",
    "RESTORATIVE DENTISTRY, ESTHETICS AND ORTHODONTICS"
  ],
  "SOFTWARES": [
    "SOFTWARE",
    "SOFTWARE"
  ]
};

/** Translates presentation only; submitted field and taxonomy values stay canonical. */
export function distributorText(language: DistributorLanguage, text: string): string {
  if (language === "pt") return text;
  const translated = translations[text];
  return translated?.[language === "es" ? 0 : 1] ?? text;
}

export function distributorCountryName(language: DistributorLanguage, isoCode: string, fallback: string): string {
  return new Intl.DisplayNames([language], { type: "region" }).of(isoCode) || fallback;
}

export function distributorCurrencyName(language: DistributorLanguage, code: string): string {
  return `${code} — ${new Intl.DisplayNames([language], { type: "currency" }).of(code) || code}`;
}
