import {
  ArrowUpRight, BookOpen, CalendarDays, CheckSquare, Download, FileText,
  Laptop, Users,
} from "lucide-react";
import {
  budget, checklist, functionalRequirements, methodology, nonFunctionalRequirements,
  projectDetails, questionnaire, resources, schedule, scope,
} from "./project-data.js";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const money = (value) => currency.format(value);

const timeline = [
  ["Planificación", 1, 1],
  ["Análisis de requisitos", 2, 2],
  ["Diseño del sistema", 3, 4],
  ["Productos e inventario", 5, 6],
  ["Ventas y caja", 6, 7],
  ["Clientes, descuentos y devoluciones", 7, 7],
  ["Proveedores y reportes", 8, 8],
  ["Sucursales y catálogo digital", 9, 9],
  ["Integración de dispositivos", 9, 9],
  ["Pruebas y ajustes", 10, 11],
  ["Implementación y capacitación", 12, 12],
];

function SectionHeading({ id, label, title, description }) {
  return (
    <div className="project-section-heading" id={id}>
      <span>{label}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function ContentTable({ columns, rows, className = "" }) {
  return (
    <div className={`project-table-wrap ${className}`}>
      <table className="project-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function ProjectDocumentation() {
  const infrastructureTotal = budget.infrastructure.reduce((sum, item) => sum + item[2], 0);
  const operatingTotal = budget.operating.reduce((sum, item) => sum + item[3], 0);
  const personnelTotal = budget.personnel.reduce((sum, item) => sum + item[2], 0);

  return (
    <div className="project-document">
      <section className="project-hero">
        <div className="project-hero-icon"><BookOpen size={22} /></div>
        <div>
          <div className="project-kicker">ANÁLISIS Y DISEÑO · FASE 1</div>
          <h1>Planificación del <em>proyecto.</em></h1>
          <p>Documento de referencia de Bella Boutique integrado en el sistema.</p>
        </div>
        <a className="button button-outline project-download" href="/api/project/document" target="_blank" rel="noreferrer">
          <Download size={16} /> Abrir PDF original
        </a>
      </section>

      <nav className="project-anchor-nav" aria-label="Secciones de la documentación">
        <a href="#project-overview">Proyecto</a>
        <a href="#project-scope">Alcance</a>
        <a href="#project-plan">Plan</a>
        <a href="#project-budget">Presupuesto</a>
        <a href="#project-questionnaire">Cuestionario</a>
        <a href="#project-requirements">Requisitos</a>
        <a href="#project-checklist">Lista de cotejo</a>
      </nav>

      <section className="project-cover panel">
        <div>
          <span className="project-overline">{projectDetails.university}</span>
          <h2>{projectDetails.degree}</h2>
          <div className="project-cover-details">
            <span><b>Asignatura</b>{projectDetails.course}</span>
            <span><b>Práctica</b>{projectDetails.practice}</span>
            <span><b>Facilitadora</b>{projectDetails.facilitator}</span>
            <span><b>Periodo</b>{projectDetails.period}</span>
          </div>
        </div>
        <div className="project-team">
          <div className="project-team-title"><Users size={16} /> Equipo</div>
          {projectDetails.team.map((member) => (
            <div className="project-team-row" key={member.registration}>
              <span>{member.registration}</span><b>{member.name}</b>
            </div>
          ))}
        </div>
      </section>

      <section id="project-overview" className="project-section">
        <SectionHeading id="project-overview-heading" label="01 · DESCRIPCIÓN" title="El proyecto" />
        <div className="project-overview-grid">
          <article className="panel project-copy-card"><h3>Descripción</h3><p>{projectDetails.description}</p></article>
          <article className="panel project-copy-card"><h3>Objetivo general</h3><p>{projectDetails.objective}</p><div className="project-callout"><b>Necesidad principal</b><span>{projectDetails.problem}</span></div></article>
        </div>
      </section>

      <section id="project-scope" className="project-section">
        <SectionHeading id="project-scope-heading" label="02 · ALCANCE" title="Qué contempla el sistema" description="Funciones y restricciones definidas con el cliente." />
        <div className="project-scope-grid">
          {scope.map((item, index) => <div className="project-scope-item" key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}
        </div>
        <div className="project-note"><FileText size={17} /><span><b>Fuera de alcance:</b> el sistema no generará facturas electrónicas.</span></div>
      </section>

      <section className="project-section">
        <SectionHeading label="03 · METODOLOGÍA" title="Desarrollo iterativo e incremental" description="El proyecto se divide en módulos pequeños para construirlos, validarlos y mejorarlos continuamente con base en las necesidades del cliente." />
        <div className="project-method-grid">
          {methodology.map(([name, description], index) => (
            <article className="panel project-method-card" key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span><div><h3>{name}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="project-section">
        <SectionHeading label="04 · RECURSOS" title="Equipo disponible" description="Recursos proporcionados por el cliente para las dos sucursales." />
        <ContentTable columns={["Recurso tecnológico", "Cantidad"]} rows={resources} />
        <p className="project-caption">Estos recursos deben considerarse durante el diseño y las pruebas de compatibilidad.</p>
      </section>

      <section id="project-plan" className="project-section">
        <SectionHeading id="project-plan-heading" label="05 · CRONOGRAMA" title="Estimación de 12 semanas" description="Plan de actividades original; la duración puede variar según la complejidad y la disponibilidad del cliente para validar avances." />
        <div className="panel project-gantt">
          <div className="project-gantt-title"><CalendarDays size={17} /><b>Diagrama de Gantt · semanas</b></div>
          <div className="project-gantt-head"><span>Actividad</span><div>{Array.from({ length: 12 }, (_, index) => <span key={index}>{index + 1}</span>)}</div></div>
          {timeline.map(([name, start, end]) => (
            <div className="project-gantt-row" key={name}>
              <span>{name}</span>
              <div className="project-gantt-track"><span className="project-gantt-bar" style={{ gridColumn: `${start} / ${end + 1}` }} title={`Semana ${start}${end !== start ? ` a ${end}` : ""}`} /></div>
            </div>
          ))}
        </div>
        <p className="project-caption">Diagrama de Gantt: elaboración propia en Canva. La duración puede modificarse según la complejidad y la disponibilidad del cliente para validar avances.</p>
        <ContentTable
          className="project-schedule-table"
          columns={["Actividad / fase", "Días aprox.", "Semana de inicio", "Semana final"]}
          rows={schedule.map(([name, days, start, end]) => [name, days, `Semana ${start}`, `Semana ${end}`])}
        />
      </section>

      <section id="project-budget" className="project-section">
        <SectionHeading id="project-budget-heading" label="06 · COSTOS" title="Estimación del presupuesto" description="Importes transcritos de las tablas del documento original." />
        <div className="project-budget-grid">
          <article className="panel project-budget-card">
            <h3><Laptop size={17} /> Materia prima · infraestructura tecnológica</h3>
            <ContentTable columns={["Concepto", "Descripción", "Costo"]} rows={budget.infrastructure.map(([name, detail, amount]) => [name, detail, money(amount)])} />
            <div className="project-budget-total"><span>Subtotal</span><b>{money(infrastructureTotal)}</b></div>
          </article>
          <article className="panel project-budget-card">
            <h3><FileText size={17} /> Insumos operativos · 3 meses</h3>
            <ContentTable columns={["Concepto", "Precio mensual", "Total"]} rows={budget.operating.map(([name, detail, monthly, total]) => [`${name} — ${detail}`, money(monthly), money(total)])} />
            <div className="project-budget-total"><span>Subtotal</span><b>{money(operatingTotal)}</b></div>
          </article>
          <article className="panel project-budget-card">
            <h3><Users size={17} /> Costos de recursos humanos</h3>
            <ContentTable columns={["Rol", "Responsabilidad", "Estimado"]} rows={budget.personnel.map(([name, detail, amount]) => [name, detail, money(amount)])} />
            <div className="project-budget-total"><span>Subtotal</span><b>{money(personnelTotal)}</b></div>
          </article>
        </div>
        <div className="panel project-total-card">
          <div><span>Presupuesto total estimado</span><small>Distribución entre infraestructura, insumos y mano de obra valorizada.</small></div>
          <strong>{money(budget.total)}</strong>
        </div>
        <p className="project-caption">El documento presenta los importes con el símbolo $ y no especifica la moneda.</p>
      </section>

      <section id="project-questionnaire" className="project-section">
        <SectionHeading id="project-questionnaire-heading" label="07 · LEVANTAMIENTO" title="Cuestionario del cliente" description="Preguntas y respuestas utilizadas para identificar las necesidades del negocio." />
        <div className="project-qa-list">
          {questionnaire.map(([topic, question, answer], index) => (
            <details className="panel project-qa-item" key={topic}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span><div><b>{topic}</b><small>{question}</small></div><ArrowUpRight size={16} /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="project-requirements" className="project-section">
        <SectionHeading id="project-requirements-heading" label="08 · ESPECIFICACIÓN" title="Requisitos del sistema" description="Los funcionales definen qué hace el sistema; los no funcionales, las condiciones de calidad y operación." />
        <article className="panel project-copy-card project-requirement-intro">
          <h3>Introducción al análisis</h3>
          <p>El análisis de requisitos estructura las necesidades y expectativas del cliente y establece la base para definir las funciones y las condiciones de operación, seguridad, rendimiento y compatibilidad. El cuestionario aplicado al cliente fue la fuente principal; permitió identificar la necesidad de agilizar las ventas y mejorar el control de inventario, ventas, ganancias y pérdidas. También se consideraron las dos sucursales, la consulta de existencias entre tiendas, los lectores de códigos de barras, los descuentos para clientas frecuentes y las reglas de cambios y devoluciones.</p>
        </article>
        <div className="project-requirement-grid">
          <article className="panel project-requirements-card">
            <h3>Requisitos funcionales</h3>
            <ContentTable columns={["ID", "Requisito", "Descripción"]} rows={functionalRequirements} />
          </article>
          <article className="panel project-requirements-card">
            <h3>Requisitos no funcionales</h3>
            <ContentTable columns={["ID", "Atributo", "Criterio"]} rows={nonFunctionalRequirements} />
          </article>
        </div>
      </section>

      <section id="project-checklist" className="project-section">
        <SectionHeading id="project-checklist-heading" label="09 · VALIDACIÓN" title="Lista de cotejo" description="Criterios del documento para dar seguimiento a actividades y entregables. Los campos se muestran sin marcar, tal como en el original." />
        <div className="panel project-checklist">
          <ContentTable
            columns={["No.", "Actividad / entregable", "Criterio a evaluar", "Sí", "No", "Observaciones"]}
            rows={checklist.map(([name, criterion], index) => [
              index + 1,
              name,
              criterion,
              <input key="yes" type="checkbox" disabled aria-label={`Sí: ${name}`} />,
              <input key="no" type="checkbox" disabled aria-label={`No: ${name}`} />,
              "",
            ])}
          />
        </div>
      </section>

      <footer className="project-source-note">
        <CheckSquare size={16} /><span>Contenido organizado a partir del documento de planificación de Bella Boutique.</span>
        <a href="/api/project/document" target="_blank" rel="noreferrer">Consultar el documento completo</a>
      </footer>
    </div>
  );
}
