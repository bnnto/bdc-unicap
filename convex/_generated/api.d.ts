/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applications from "../applications.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as authorize from "../authorize.js";
import type * as consentTerms from "../consentTerms.js";
import type * as consents from "../consents.js";
import type * as crons from "../crons.js";
import type * as extensionProjects from "../extensionProjects.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as lgpd from "../lgpd.js";
import type * as lib_currentUser from "../lib/currentUser.js";
import type * as operational from "../operational.js";
import type * as password from "../password.js";
import type * as students from "../students.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applications: typeof applications;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  authorize: typeof authorize;
  consentTerms: typeof consentTerms;
  consents: typeof consents;
  crons: typeof crons;
  extensionProjects: typeof extensionProjects;
  health: typeof health;
  http: typeof http;
  jobs: typeof jobs;
  lgpd: typeof lgpd;
  "lib/currentUser": typeof lib_currentUser;
  operational: typeof operational;
  password: typeof password;
  students: typeof students;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
