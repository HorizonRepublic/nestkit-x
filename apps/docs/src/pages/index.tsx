import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import React from 'react';

import styles from './index.module.css';

const homepageHeader = (): React.JSX.Element => {
  const { siteConfig } = useDocusaurusContext();

  return (
    <header className={clsx('hero hero--primary', styles['heroBanner'])}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles['buttons']}>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
};

const home = (): React.JSX.Element => {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      description="Powerful NestJS toolkit for rapid application development with zero boilerplate"
      title={`${siteConfig.title} - NestJS Toolkit`}
    >
      {homepageHeader()}
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
};

export default home;
