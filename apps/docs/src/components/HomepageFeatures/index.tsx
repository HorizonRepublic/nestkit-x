import { translate } from '@docusaurus/core/lib/client/exports/Translate';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import React, { ReactNode } from 'react';

import styles from './styles.module.css';

interface IFeatureItem {
  description: ReactNode;
  imgPath: string;
  title: string;
}

const featureList: IFeatureItem[] = [
  {
    description: translate({
      id: 'docs.intro.feature-1.description',
      message: `Modular architecture lets you easily add and configure functionality. Just register modules
        — everything works without additional main.ts setup.`,
    }),
    imgPath: '/feature-images/feature-1.png',
    title: translate({ id: 'docs.intro.feature-1.tittle', message: 'Modular Approach' }),
  },
  {
    description: translate({
      id: 'docs.intro.feature-2.description',
      message: `Ready-to-use solution: validation, caching, API docs, logging. No need to configure each
        component separately.`,
    }),
    imgPath: '/feature-images/feature-3.png',
    title: translate({
      id: 'docs.intro.feature-2.message',
      message: 'Batteries Included',
    }),
  },
  {
    description: translate({
      id: 'docs.intro.feature-3.description',
      message: `Minimal boilerplate code. Most configurations are pre-configured by default. Focus on
        business logic, not routine setup.`,
    }),
    imgPath: '/feature-images/feature-2.png',
    title: translate({
      id: 'docs.intro.feature-3.message',
      message: 'Easy to Use',
    }),
  },
];

const featureComponent = ({
                            description,
                            imgPath,
                            title,
                          }: Readonly<IFeatureItem>): React.JSX.Element => (
  <div className={clsx('col col--4', styles.featureCard)}>
    <section className={clsx('feature-item')}>
      <div className={clsx('text--center', styles.featureImgContainer)}>
        <img
          alt={`${title} illustration`}
          className={styles.featureImg}
          loading="lazy"
          role="img"
          src={imgPath}
        />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3" className={styles.featureTitle}>
          {title}
        </Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </section>
  </div>
);

const HomePageFeatures = (): React.JSX.Element => (
  <section className={styles.features}>
    <div className="container">
      <div className={clsx('row features', styles.featuresRow)}>
        {featureList.map((props, idx) => (
          <React.Fragment key={idx}>{featureComponent(props)}</React.Fragment>
        ))}
      </div>
    </div>
  </section>
);

export default HomePageFeatures;
