// Lista curada de instituições de ensino superior brasileiras (MEC).
// Não é a base completa do e-MEC (~2.6k IES); é um subconjunto das principais
// instituições com forte presença em Odontologia, usado como sugestão via
// datalist. O campo aceita texto livre para permitir qualquer IES cadastrada
// no MEC ou instituições internacionais.
export const MEC_INSTITUTIONS: string[] = [
  "USP - Universidade de São Paulo",
  "USP - FOUSP (Faculdade de Odontologia)",
  "USP - FORP Ribeirão Preto",
  "USP - FOB Bauru",
  "UNICAMP - Universidade Estadual de Campinas",
  "UNESP - Universidade Estadual Paulista",
  "UNESP - Araraquara",
  "UNESP - São José dos Campos",
  "UNESP - Araçatuba",
  "UFRJ - Universidade Federal do Rio de Janeiro",
  "UERJ - Universidade do Estado do Rio de Janeiro",
  "UFF - Universidade Federal Fluminense",
  "UFMG - Universidade Federal de Minas Gerais",
  "PUC Minas",
  "PUC-SP",
  "PUC-Rio",
  "PUC-RS",
  "PUC-PR",
  "PUC Campinas",
  "UFRGS - Universidade Federal do Rio Grande do Sul",
  "UFSC - Universidade Federal de Santa Catarina",
  "UFPR - Universidade Federal do Paraná",
  "UFBA - Universidade Federal da Bahia",
  "UFPE - Universidade Federal de Pernambuco",
  "UFC - Universidade Federal do Ceará",
  "UFPB - Universidade Federal da Paraíba",
  "UFRN - Universidade Federal do Rio Grande do Norte",
  "UFG - Universidade Federal de Goiás",
  "UnB - Universidade de Brasília",
  "UFES - Universidade Federal do Espírito Santo",
  "UFPA - Universidade Federal do Pará",
  "UFAM - Universidade Federal do Amazonas",
  "UFMT - Universidade Federal do Mato Grosso",
  "UFMS - Universidade Federal do Mato Grosso do Sul",
  "UEL - Universidade Estadual de Londrina",
  "UEM - Universidade Estadual de Maringá",
  "UEPG - Universidade Estadual de Ponta Grossa",
  "UPF - Universidade de Passo Fundo",
  "ULBRA - Universidade Luterana do Brasil",
  "UNISINOS",
  "Mackenzie",
  "FGV",
  "Anhembi Morumbi",
  "Estácio",
  "UNIP - Universidade Paulista",
  "Cruzeiro do Sul",
  "Uninove",
  "São Leopoldo Mandic",
  "APCD - Associação Paulista de Cirurgiões-Dentistas",
  "ABO - Associação Brasileira de Odontologia",
  "ILAPEO",
  "SENAC",
  "Outra (não listada)",
];

export const UNIVERSITY_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "docencia", label: "Docência" },
  { value: "pesquisa", label: "Pesquisa" },
  { value: "extensao", label: "Extensão" },
  { value: "gestao", label: "Gestão" },
];

export const QUALIFICATION_LEVELS: { value: string; label: string }[] = [
  { value: "graduacao", label: "Graduação" },
  { value: "especializacao", label: "Especialização" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
  { value: "pos_doutorado", label: "Pós-doutorado" },
];

export interface QualificationEntry {
  institution: string;
  completion_date: string; // yyyy-mm ou yyyy-mm-dd
  course?: string;
}

export interface UniversityRoleEntry {
  institution: string;
  role: string; // one of UNIVERSITY_ROLE_OPTIONS.value
}