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
    description: (
      <>
        Modular architecture lets you easily add and configure functionality. Just register modules
        — everything works without additional main.ts setup.
      </>
    ),
    imgPath: '/logo/nestkix-x-logo.favicon.png',
    title: 'Modular Approach',
  },
  {
    description: (
      <>
        Minimal boilerplate code. Most configurations are pre-configured by default. Focus on
        business logic, not routine setup.
      </>
    ),
    imgPath: '/logo/nestkix-x-logo.favicon.png',
    title: 'Easy to Use',
  },
  {
    description: (
      <>
        Ready-to-use solution: validation, caching, API docs, logging. No need to configure each
        component separately.
      </>
    ),
    imgPath: '/logo/nestkix-x-logo.favicon.png',
    title: 'Batteries Included',
  },
];

const featureComponent = ({
  description,
  imgPath,
  title,
}: Readonly<IFeatureItem>): React.JSX.Element => (
  <div className={clsx('col col--4')}>
    <div className="text--center">
      <img
        alt={`${title} illustration`}
        className={styles['featureImg']}
        loading="lazy"
        role="img"
        src={imgPath}
      />
    </div>
    <div className="text--center padding-horiz--md">
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
    </div>
  </div>
);

const homepageFeatures = (): React.JSX.Element => (
  <section className={styles['features']}>
    <div className="container">
      <div className="row">
        {featureList.map((props, idx) => (
          <React.Fragment key={idx}>{featureComponent(props)}</React.Fragment>
        ))}
      </div>
    </div>
  </section>
);

export default homepageFeatures;
