import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

@Injectable({
  providedIn: 'root',
})
export class AmplifyService {
  // Store the Amplify client
  private readonly amplifyClient;

  constructor() {
    // Instantiate the client once
    this.amplifyClient = generateClient<Schema>();
  }

  get client() {
    return this.amplifyClient;
  }
}
