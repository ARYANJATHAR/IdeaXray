import { IconBook2, IconBulb, IconChartBar, IconHistory, IconScale, IconShoppingBag } from "@tabler/icons-react";

export const investigationTopics = [
  { title: "Patents", description: "The inventions and mechanisms already on the record.", icon: IconScale },
  { title: "Research", description: "The papers and discoveries moving an idea forward.", icon: IconBook2 },
  { title: "Products", description: "The solutions people can already use or buy.", icon: IconShoppingBag },
  { title: "Market", description: "The companies, news, and interest around a concept.", icon: IconChartBar },
  { title: "History", description: "Earlier attempts, turning points, and lessons left behind.", icon: IconHistory },
  { title: "Opportunity gaps", description: "Less represented areas that deserve a closer look.", icon: IconBulb },
] as const;

export function InvestigationTopics() {
  return (
    <section id="investigation" className="investigation-section page-width" aria-labelledby="investigation-title">
      <div className="section-heading">
        <p className="eyebrow">A wider perspective</p>
        <h2 id="investigation-title">Every idea has a backstory.</h2>
        <p>Bring the scattered pieces together before deciding what comes next.</p>
      </div>
      <div className="topic-grid grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {investigationTopics.map(({ title, description, icon: Icon }) => <article className="topic topic-card" key={title}>
          <span className="topic-icon"><Icon size={24} stroke={1.5} aria-hidden="true" /></span>
          <div><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
    </section>
  );
}
