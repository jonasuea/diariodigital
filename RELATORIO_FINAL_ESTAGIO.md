# RELATÓRIO FINAL DE ESTÁGIO CURRICULAR SUPERVISIONADO

---

**Poder Executivo**

**Ministério da Educação**

**Universidade Federal do Amazonas**

**Coordenação de Estágio de Engenharia de Software – UFAM**

---

# [NOME COMPLETO DO ESTAGIÁRIO]

# UNIVERSIDADE FEDERAL DO AMAZONAS

# INSTITUTO DE CIÊNCIAS EXATAS E TECNOLOGIA

# CURSO DE ENGENHARIA DE SOFTWARE

# ESTÁGIO CURRICULAR SUPERVISIONADO

# RELATÓRIO FINAL

Relatório Final Apresentado como requisito parcial para aprovação na disciplina Estágio Supervisionado.

**Orientador:** [Nome do Orientador]

**ITACOATIARA-AM**

**DEZEMBRO – 2025**

---

# Sumário

1. Introdução
2. Desenvolvimento
   - 2.1 Objetivo Geral
   - 2.2 Objetivos Específicos
   - 2.3 Justificativa
   - 2.4 Metodologia
   - 2.5 Apresentação da Instituição
   - 2.6 Atividades Desenvolvidas
3. Conclusões/Considerações Finais
4. Referências Bibliográficas

---

# 1. Introdução

A disciplina Estágio Curricular Supervisionado em Engenharia de Software tem como propósito fundamental proporcionar ao discente a vivência prática dos conhecimentos teóricos adquiridos ao longo da graduação, permitindo o desenvolvimento de competências técnicas, analíticas e profissionais essenciais para a atuação no mercado de trabalho. Por meio dessa experiência, o estudante tem a oportunidade de aplicar conceitos de desenvolvimento de software, arquitetura de sistemas, engenharia de requisitos, modelagem de dados e boas práticas de programação em projetos reais, consolidando sua formação acadêmica.

Neste contexto, o presente relatório descreve as atividades desenvolvidas durante o período de estágio, cujo foco foi a concepção, desenvolvimento e implantação da plataforma web EducaFácil, um sistema de gestão escolar voltado à organização das rotinas de secretaria e gestão pedagógica de instituições de ensino. A plataforma foi projetada para atender às demandas administrativas e acadêmicas de escolas, oferecendo módulos integrados para cadastro de alunos, professores, turmas e equipe gestora, além de funcionalidades para gerenciamento de horários, calendário escolar, diário digital, frequência, notas e geração de relatórios.

O desenvolvimento da plataforma EducaFácil foi realizado utilizando tecnologias modernas de desenvolvimento web, incluindo React com Vite para a construção da interface do usuário, Tailwind CSS para estilização responsiva, e Lovable Cloud com Supabase para o gerenciamento do banco de dados PostgreSQL, autenticação de usuários e operações de persistência de dados. Essa escolha tecnológica permitiu a construção de uma aplicação robusta, escalável e de fácil manutenção, alinhada às melhores práticas da indústria de software.

Este relatório tem como objetivo apresentar de forma detalhada o contexto do projeto, os objetivos gerais e específicos estabelecidos, a metodologia de desenvolvimento adotada, as atividades realizadas ao longo do estágio e os resultados alcançados. Além disso, são apresentados os aprendizados técnicos e profissionais obtidos durante a experiência, bem como as considerações sobre possíveis evoluções futuras do sistema.

---

# 2. Desenvolvimento

## 2.1 Objetivo Geral

O objetivo geral do estágio foi desenvolver e implantar uma plataforma web completa de gestão escolar, denominada EducaFácil, contemplando módulos de cadastro e gerenciamento de alunos, professores, turmas e equipe gestora, além de funcionalidades para configuração de horários de aula, calendário escolar e eventos, diário digital com registro de frequência e notas, e geração de relatórios administrativos e pedagógicos. O projeto visou aplicar na prática os conhecimentos adquiridos ao longo do curso de Engenharia de Software, integrando conceitos de desenvolvimento frontend e backend, modelagem de dados, experiência do usuário e engenharia de software em um sistema funcional de valor real para instituições de ensino.

## 2.2 Objetivos Específicos

Para alcançar o objetivo geral, foram definidos os seguintes objetivos específicos:

- Implementar o módulo de cadastro e gerenciamento de alunos, contemplando dados pessoais, familiares, escolares e administrativos, com funcionalidades de busca, edição e exclusão de registros.

- Desenvolver o módulo de cadastro e gerenciamento de professores, incluindo informações profissionais, disciplinas lecionadas, formação acadêmica e status funcional.

- Criar o módulo de gerenciamento de turmas, permitindo a definição de série, turno, capacidade e associação de professores responsáveis.

- Implementar o módulo de equipe gestora, possibilitando o cadastro de diretores, coordenadores e demais membros da administração escolar.

- Desenvolver o módulo de horário de aulas, permitindo a configuração da grade horária semanal para cada turma.

- Criar o módulo de calendário escolar e eventos, possibilitando o cadastro, visualização e gerenciamento de eventos acadêmicos, reuniões, feriados e provas.

- Implementar o diário digital com funcionalidades de registro de frequência diária e lançamento de notas por bimestre.

- Construir o módulo de relatórios, permitindo a geração de documentos em formato PDF com dados acadêmicos e administrativos.

- Desenvolver a tela de configurações do sistema, incluindo informações da escola e preferências do usuário.

- Integrar o frontend desenvolvido em React, Vite e Tailwind CSS com o backend Supabase, implementando autenticação de usuários e operações CRUD completas em todas as telas.

- Aplicar boas práticas de desenvolvimento de software, incluindo organização de componentes, consumo de APIs, gerenciamento de estado e código limpo.

## 2.3 Justificativa

A gestão eficiente de instituições de ensino representa um desafio significativo para administradores, coordenadores e professores. Muitas escolas, especialmente aquelas de menor porte ou localizadas em regiões com menor acesso a recursos tecnológicos, ainda dependem de processos manuais, planilhas eletrônicas dispersas e documentos físicos para organizar informações de alunos, turmas, horários e eventos. Essa abordagem fragmentada resulta em dificuldades para localizar informações, inconsistência de dados, retrabalho e ineficiência operacional.

A ausência de um sistema centralizado para gestão escolar dificulta o acompanhamento do desempenho acadêmico dos alunos, o controle de frequência, a organização de horários e a comunicação entre os diversos setores da escola. Além disso, a geração de relatórios e documentos oficiais torna-se um processo trabalhoso e propenso a erros, comprometendo a tomada de decisões e a qualidade do serviço prestado à comunidade escolar.

Nesse contexto, o desenvolvimento da plataforma EducaFácil justifica-se pela necessidade de oferecer uma solução tecnológica acessível, intuitiva e completa para a gestão escolar. O sistema foi projetado para centralizar todas as informações administrativas e pedagógicas em uma única plataforma web, permitindo acesso rápido e seguro aos dados, automação de processos rotineiros e geração de relatórios precisos.

Do ponto de vista acadêmico, o projeto EducaFácil representa uma oportunidade significativa para aplicar e integrar conhecimentos de diversas disciplinas do curso de Engenharia de Software, incluindo Programação Web, Banco de Dados, Engenharia de Requisitos, Arquitetura de Software, Interface Homem-Computador e Gerência de Projetos. O desenvolvimento de um sistema real, com usuários e requisitos concretos, proporciona uma experiência de aprendizado incomparável, preparando o discente para os desafios do mercado de trabalho.

## 2.4 Metodologia

A metodologia de desenvolvimento adotada durante o estágio seguiu uma abordagem incremental e iterativa, caracterizada pela construção progressiva dos módulos do sistema, com entregas parciais e validações contínuas. Essa abordagem permitiu identificar e corrigir problemas rapidamente, além de adaptar o desenvolvimento às necessidades identificadas ao longo do processo.

O desenvolvimento foi organizado nas seguintes etapas:

**1. Levantamento de Requisitos e Estudo do Domínio**

Inicialmente, foi realizado um estudo aprofundado do fluxo de trabalho escolar e das necessidades de gestão de uma instituição de ensino. Foram identificados os principais processos administrativos e pedagógicos, os atores envolvidos e as informações que precisavam ser gerenciadas pelo sistema. Esse levantamento resultou na definição dos módulos e funcionalidades que comporiam a plataforma EducaFácil.

**2. Definição da Arquitetura e Modelagem de Dados**

Com base nos requisitos identificados, foi definida a arquitetura do sistema, optando-se por uma separação entre frontend e backend. Para o frontend, foram escolhidos React com Vite como framework de desenvolvimento, e Tailwind CSS para estilização. Para o backend, foi utilizado o Lovable Cloud com Supabase, que oferece banco de dados PostgreSQL, autenticação integrada e API para operações de dados.

A modelagem de dados resultou na criação das seguintes tabelas principais: alunos, professores, turmas, equipe_gestora, eventos, horarios, frequencia, notas, anotacoes, usuarios e profiles. Foram definidas as relações entre as tabelas, incluindo chaves estrangeiras para associação de alunos a turmas, turmas a professores, entre outras.

**3. Desenvolvimento Iterativo dos Módulos**

O desenvolvimento seguiu um ciclo iterativo, onde cada módulo foi implementado de forma completa antes de prosseguir para o próximo. Para cada módulo, foram realizadas as seguintes atividades:
- Criação da estrutura de componentes React
- Implementação da interface visual com Tailwind CSS
- Integração com o banco de dados Supabase
- Implementação das operações CRUD
- Testes funcionais e correções

**4. Ferramentas Utilizadas**

O desenvolvimento foi realizado utilizando as seguintes ferramentas e tecnologias:
- **React 18** com **Vite** para construção da aplicação frontend
- **TypeScript** para tipagem estática e maior segurança do código
- **Tailwind CSS** para estilização responsiva e consistente
- **shadcn/ui** para componentes de interface reutilizáveis
- **Supabase** para banco de dados PostgreSQL, autenticação e storage
- **React Router** para navegação entre páginas
- **React Query** para gerenciamento de estado e cache de dados
- **Lucide React** para ícones
- **jsPDF** e **jspdf-autotable** para geração de relatórios em PDF
- **Recharts** para visualização de dados em gráficos
- **Git e GitHub** para controle de versão

**5. Testes e Refinamentos**

Ao longo do desenvolvimento, foram realizados testes funcionais em cada módulo implementado, verificando o correto funcionamento das operações de criação, leitura, atualização e exclusão de dados. Foram identificados e corrigidos bugs de navegação, validação de formulários e integração com o banco de dados. Também foram realizadas melhorias de usabilidade e responsividade da interface.

## 2.5 Apresentação da Instituição

O estágio foi realizado no contexto da disciplina Estágio Curricular Supervisionado do curso de Engenharia de Software da Universidade Federal do Amazonas (UFAM), vinculada ao Instituto de Ciências Exatas e Tecnologia (ICET), localizado no município de Itacoatiara, Amazonas.

O curso de Engenharia de Software da UFAM tem como objetivo formar profissionais capacitados para atuar no desenvolvimento de sistemas de software, aplicando princípios de engenharia para a construção de soluções tecnológicas de qualidade. A grade curricular contempla disciplinas teóricas e práticas que abrangem programação, banco de dados, engenharia de requisitos, arquitetura de software, testes, gerência de projetos e desenvolvimento web, entre outras.

O projeto EducaFácil foi desenvolvido em parceria com a Escola Municipal Dom Paulo McHugh, instituição de ensino fundamental localizada no município de Itacoatiara. A escola forneceu o contexto real para o levantamento de requisitos e validação das funcionalidades desenvolvidas, possibilitando que o sistema fosse projetado para atender às necessidades concretas de uma instituição de ensino.

A Escola Municipal Dom Paulo McHugh atende alunos do ensino fundamental e enfrenta os desafios típicos de gestão escolar, incluindo a necessidade de organizar informações de alunos, turmas, horários e eventos de forma eficiente. A parceria permitiu compreender as rotinas administrativas e pedagógicas da escola, orientando o desenvolvimento de funcionalidades que agregam valor real ao trabalho dos gestores e professores.

## 2.6 Atividades Desenvolvidas

As atividades desenvolvidas durante o estágio foram organizadas de forma a contemplar todas as etapas do ciclo de desenvolvimento de software, desde o levantamento de requisitos até a entrega de uma plataforma funcional. A seguir, são detalhadas as principais atividades realizadas:

### Definição de Requisitos e Arquitetura do Sistema

A primeira etapa do projeto consistiu no mapeamento detalhado dos módulos e funcionalidades que comporiam a plataforma EducaFácil. Foram identificados os seguintes módulos principais:

- **Painel (Dashboard):** Tela inicial com visualização de estatísticas gerais, gráficos de frequência, eventos próximos e atividades recentes.
- **Alunos:** Cadastro completo de alunos com dados pessoais, familiares, escolares e administrativos.
- **Professores:** Cadastro de professores com informações profissionais e acadêmicas.
- **Turmas:** Gerenciamento de turmas com definição de série, turno, capacidade e professores.
- **Equipe Gestora:** Cadastro de membros da administração escolar.
- **Horário:** Configuração da grade horária semanal por turma.
- **Calendário:** Gerenciamento de eventos escolares, reuniões e feriados.
- **Diário Digital:** Registro de frequência e lançamento de notas por bimestre.
- **Relatórios:** Geração de relatórios em PDF.
- **Configurações:** Parâmetros do sistema e perfil do usuário.

Foi definida a arquitetura do sistema baseada em uma Single Page Application (SPA) com React no frontend e Supabase como Backend as a Service (BaaS). Essa arquitetura permite uma experiência de usuário fluida, com navegação rápida entre as telas e comunicação eficiente com o servidor.

### Modelagem de Dados no Banco de Dados

A modelagem de dados foi realizada considerando as entidades identificadas no levantamento de requisitos e seus relacionamentos. Foram criadas as seguintes tabelas no banco de dados PostgreSQL via Supabase:

- **alunos:** Armazena dados completos dos alunos, incluindo nome, matrícula, data de nascimento, documentos, endereço, dados familiares, informações de saúde e dados administrativos.
- **professores:** Contém informações dos professores, incluindo dados pessoais, disciplinas lecionadas, formação acadêmica e status funcional.
- **turmas:** Registra as turmas da escola, com informações de série, turno, ano, capacidade e associação com professores.
- **equipe_gestora:** Armazena dados dos membros da equipe gestora da escola.
- **eventos:** Contém os eventos do calendário escolar, com data, horário, local e tipo.
- **horarios:** Registra a grade horária de cada turma.
- **frequencia:** Armazena os registros de frequência diária dos alunos.
- **notas:** Contém as notas dos alunos por disciplina e bimestre.
- **profiles:** Armazena informações de perfil dos usuários autenticados.
- **user_roles:** Gerencia os papéis e permissões dos usuários do sistema.

Foram configuradas as relações entre as tabelas utilizando chaves estrangeiras, garantindo a integridade referencial dos dados. Além disso, foram implementadas políticas de Row Level Security (RLS) para controle de acesso aos dados baseado no usuário autenticado.

### Desenvolvimento do Frontend com React e Tailwind CSS

O desenvolvimento do frontend foi realizado utilizando React com TypeScript, seguindo uma arquitetura baseada em componentes reutilizáveis. A estilização foi implementada com Tailwind CSS, garantindo uma interface visual consistente, moderna e responsiva.

Foi criada uma estrutura de layout base composta por:
- **AppLayout:** Componente principal que encapsula todas as páginas, gerenciando a sidebar e o header.
- **AppSidebar:** Menu lateral de navegação com links para todos os módulos do sistema.
- **AppHeader:** Cabeçalho com informações do usuário e notificações.

Para cada módulo do sistema, foi desenvolvida uma página específica com as seguintes funcionalidades:

**Painel (Dashboard):**
- Cards de estatísticas mostrando total de alunos, turmas, eventos e média de notas.
- Gráfico de frequência semanal utilizando a biblioteca Recharts.
- Lista de próximos eventos e atividades recentes.

**Alunos:**
- Tabela com listagem de todos os alunos cadastrados.
- Campo de busca por nome ou matrícula.
- Botões de ação para visualizar perfil, editar e excluir registros.
- Formulário completo para cadastro de novos alunos com múltiplas seções.
- Tela de perfil individual do aluno com todas as informações.

**Professores:**
- Tabela com listagem de professores.
- Funcionalidades de busca, visualização, edição e exclusão.
- Formulário de cadastro com informações pessoais, profissionais e acadêmicas.

**Turmas:**
- Visualização de turmas em cards organizados por série.
- Informações de capacidade, turno e professores responsáveis.
- Formulário para criação e edição de turmas.

**Equipe Gestora:**
- Tabela com membros da equipe gestora.
- Cadastro com informações de cargo, formação e biografia.

**Horário:**
- Seleção de turma via sidebar.
- Exibição da grade horária semanal.
- Configuração de disciplinas por horário e dia da semana.

**Calendário:**
- Visualização de eventos em formato de calendário mensal.
- Formulário para cadastro de novos eventos com data, horário, local e tipo.
- Listagem de eventos com opções de edição e exclusão.

**Diário Digital:**
- Seleção de professor e turma.
- Módulo de frequência com registro de presença por data.
- Sistema de três estados: presente, ausente e justificado.
- Modal para inserção de justificativa em caso de falta.
- Módulo de notas com lançamento por disciplina e bimestre.
- Cálculo automático de média anual.

**Relatórios:**
- Interface para seleção de tipo de relatório.
- Geração de PDF com dados acadêmicos e administrativos.
- Templates para ata final, boletim e outros documentos.

**Configurações:**
- Informações da escola.
- Preferências do sistema.
- Edição de perfil do usuário.

### Integração com Supabase

A integração com o Supabase foi implementada utilizando o cliente JavaScript oficial da plataforma. Foram desenvolvidas funções para realizar operações CRUD em todas as tabelas do sistema, incluindo:

- Listagem de registros com filtros e ordenação.
- Criação de novos registros com validação de dados.
- Atualização de registros existentes.
- Exclusão de registros com confirmação.
- Tratamento de erros de rede e banco de dados.

A autenticação de usuários foi implementada utilizando o Supabase Auth, com suporte a login por email e senha. Foi desenvolvido um sistema de controle de acesso baseado em papéis (admin, gestor, professor, aluno), armazenados em uma tabela separada para garantir a segurança do sistema.

### Implementação do Sistema de Autenticação

O sistema de autenticação foi implementado seguindo as melhores práticas de segurança:

- Tela de login com validação de credenciais.
- Tela de cadastro para novos usuários.
- Sistema de aprovação de acesso por administrador.
- Proteção de rotas para usuários não autenticados.
- Controle de permissões baseado em papéis.
- Logout com limpeza de sessão.

### Testes, Ajustes e Refinamentos

Durante todo o processo de desenvolvimento, foram realizados testes funcionais para validar o correto funcionamento das features implementadas. Os testes incluíram:

- Verificação das operações CRUD em todas as telas.
- Testes de fluxo de navegação entre páginas.
- Validação de formulários e tratamento de erros.
- Testes de responsividade em diferentes tamanhos de tela.
- Verificação de integração com o banco de dados.
- Testes de autenticação e controle de acesso.

Foram identificados e corrigidos diversos bugs, incluindo problemas de navegação, validação de campos, exibição de dados e integração com APIs. Também foram realizadas melhorias de usabilidade, como feedbacks visuais para ações do usuário, mensagens de confirmação e tratamento de estados de carregamento.

As atividades foram realizadas ao longo de aproximadamente 12 semanas de estágio, seguindo o cronograma estabelecido pela disciplina e adaptando-se às necessidades identificadas durante o desenvolvimento.

---

# 3. Conclusões/Considerações Finais

O estágio supervisionado dedicado ao desenvolvimento da plataforma EducaFácil proporcionou uma experiência prática de grande valor para a formação em Engenharia de Software. A construção de um sistema real, com requisitos concretos e usuários definidos, permitiu vivenciar os desafios e as satisfações do ciclo completo de desenvolvimento de software, desde a concepção até a entrega de uma solução funcional.

O projeto permitiu integrar de forma significativa os conteúdos estudados ao longo do curso de Engenharia de Software. Conceitos de desenvolvimento web, incluindo a construção de interfaces responsivas com React e Tailwind CSS, foram aplicados na prática. Conhecimentos de banco de dados foram utilizados na modelagem das tabelas e na implementação das operações de persistência. Princípios de engenharia de software orientaram a organização do código em componentes reutilizáveis, a separação de responsabilidades e a adoção de boas práticas de programação. Conceitos de experiência do usuário guiaram o design da interface, buscando facilidade de uso e eficiência nas interações.

Os resultados alcançados ao término do estágio incluem uma plataforma web funcional e completa para gestão escolar, contemplando todos os módulos previstos. O sistema permite o cadastro e gerenciamento de alunos, professores, turmas e equipe gestora. As funcionalidades de horário e calendário estão operacionais, assim como o diário digital com registro de frequência e notas. O módulo de relatórios permite a geração de documentos em PDF. O sistema de autenticação garante o controle de acesso aos dados. A navegação entre as telas é fluida e a interface é responsiva, adaptando-se a diferentes dispositivos.

Do ponto de vista técnico, o estágio proporcionou aprendizados valiosos em diversas áreas. O desenvolvimento com React e TypeScript consolidou conhecimentos de programação frontend moderna. A utilização do Tailwind CSS demonstrou a eficiência de abordagens utility-first para estilização. A integração com Supabase permitiu compreender o funcionamento de plataformas Backend as a Service e a importância de uma boa modelagem de dados. A implementação de autenticação e controle de acesso reforçou conceitos de segurança de sistemas. A geração de relatórios em PDF ampliou o repertório de bibliotecas e ferramentas disponíveis para desenvolvimento web.

Além dos aprendizados técnicos, o estágio contribuiu para o desenvolvimento de competências profissionais importantes. A necessidade de organização e planejamento das atividades, a autonomia na resolução de problemas, a documentação do trabalho realizado e a comunicação dos resultados são habilidades essenciais para a atuação profissional que foram exercitadas durante o período.

Como trabalhos futuros, identificam-se diversas possibilidades de evolução para a plataforma EducaFácil. O módulo de relatórios pode ser expandido com novos tipos de documentos e opções de personalização. Dashboards analíticos mais avançados podem ser implementados, com indicadores de desempenho e visualizações interativas. O sistema de permissões pode ser refinado, permitindo configurações mais granulares de acesso por tipo de usuário. Melhorias de design e acessibilidade podem tornar o sistema ainda mais inclusivo e agradável de usar. A implementação de notificações e alertas pode melhorar a comunicação entre os usuários do sistema. Por fim, a integração com outros sistemas escolares ou governamentais pode ampliar o alcance e a utilidade da plataforma.

Em síntese, o estágio supervisionado com o projeto EducaFácil representou uma experiência formativa completa, alinhada aos objetivos da disciplina e do curso de Engenharia de Software. O desenvolvimento de uma solução real para gestão escolar permitiu aplicar conhecimentos teóricos em um contexto prático, preparando o discente para os desafios profissionais da área de tecnologia.

---

# 4. Referências Bibliográficas

FACEBOOK INC. **React Documentation**. Disponível em: https://react.dev. Acesso em: 05 dez. 2025.

VITEJS. **Vite Documentation**. Disponível em: https://vitejs.dev. Acesso em: 05 dez. 2025.

TAILWIND LABS. **Tailwind CSS Documentation**. Disponível em: https://tailwindcss.com/docs. Acesso em: 05 dez. 2025.

SUPABASE. **Supabase Documentation**. Disponível em: https://supabase.com/docs. Acesso em: 05 dez. 2025.

SHADCN. **shadcn/ui Documentation**. Disponível em: https://ui.shadcn.com. Acesso em: 05 dez. 2025.

TANSTACK. **TanStack Query Documentation**. Disponível em: https://tanstack.com/query. Acesso em: 05 dez. 2025.

TYPESCRIPT. **TypeScript Documentation**. Disponível em: https://www.typescriptlang.org/docs. Acesso em: 05 dez. 2025.

PARALLAX. **jsPDF Documentation**. Disponível em: https://artskydj.github.io/jsPDF/docs/jsPDF.html. Acesso em: 05 dez. 2025.

RECHARTS. **Recharts Documentation**. Disponível em: https://recharts.org. Acesso em: 05 dez. 2025.

SOMMERVILLE, Ian. **Engenharia de Software**. 10. ed. São Paulo: Pearson, 2018.

PRESSMAN, Roger S.; MAXIM, Bruce R. **Engenharia de Software: Uma Abordagem Profissional**. 8. ed. Porto Alegre: AMGH, 2016.

NIELSEN, Jakob. **Usabilidade na Web: Projetando Websites com Qualidade**. Rio de Janeiro: Elsevier, 2007.

KRUG, Steve. **Não Me Faça Pensar**. 3. ed. Rio de Janeiro: Alta Books, 2014.

MOZILLA DEVELOPER NETWORK. **MDN Web Docs**. Disponível em: https://developer.mozilla.org. Acesso em: 05 dez. 2025.

---

# Data do Início e Fim do Estágio

**Início:** [Data de Início]

**Fim:** [Data de Término]

---

*Documento elaborado como requisito parcial para aprovação na disciplina Estágio Curricular Supervisionado do curso de Engenharia de Software da Universidade Federal do Amazonas – UFAM.*
