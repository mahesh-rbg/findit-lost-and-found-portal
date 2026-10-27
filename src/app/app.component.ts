import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

type ReportStatus = 'LOST' | 'FOUND';

interface Item {
  id: string;
  name: string;
  category: string;
  location: string;
  date: string;
  status: ReportStatus;
  icon: string;
  description: string;
  contactName: string;
  contactMethod: string;
}

interface ApiItem {
  id: string;
  name: string;
  category: string;
  location: string;
  date: string;
  status: ReportStatus;
  description?: string;
  contactName?: string;
  contactMethod?: string;
  createdAt?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  item?: ApiItem;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  private readonly API_URL = 'http://localhost:3000/api';

  // Search and filters
  searchTerm = '';
  selectedType = 'ALL';
  selectedCategory = 'ALL';

  // Report form
  showReportForm = false;
  reportType: ReportStatus = 'LOST';

  // Claim form
  showClaimForm = false;
  selectedItem: Item | null = null;

  // Loading and submission states
  isLoading = false;
  isSubmittingReport = false;
  isSubmittingClaim = false;
  deletingItemIds = new Set<string>();
  errorMessage = '';

  // Available categories
  categories: string[] = [
    'Electronics',
    'Accessories',
    'ID Cards',
    'Bags',
    'Other'
  ];

  // Listings are loaded from the backend.
  items: Item[] = [];

  // New report form data
  newItem = this.createEmptyItem();

  // Claim form data
  claimForm = {
    claimantName: '',
    claimantContact: '',
    identifyingDetails: ''
  };

  constructor(private http: HttpClient) {}

  // Load listings when the application starts.
  ngOnInit(): void {
    this.loadItems();
  }

  // Create an empty report.
  private createEmptyItem() {
    return {
      name: '',
      category: 'Electronics',
      location: '',
      date: this.getLocalDate(),
      description: '',
      contactName: '',
      contactMethod: ''
    };
  }

  // Get today's date in YYYY-MM-DD format.
  private getLocalDate(): string {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Select an icon based on the item category.
  private getIcon(category: string): string {
    const icons: Record<string, string> = {
      Electronics: '🎧',
      Accessories: '🔑',
      'ID Cards': '🪪',
      Bags: '🎒',
      Other: '📦'
    };

    return icons[category] || '📦';
  }

  // Format a date for display.
  private formatDate(dateValue: string): string {
    if (!dateValue) {
      return '';
    }

    // Leave dates such as 27 Oct 2026 unchanged.
    if (/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/.test(dateValue)) {
      return dateValue;
    }

    const datePart = dateValue.substring(0, 10);
    const parts = datePart.split('-');

    if (parts.length !== 3) {
      return dateValue;
    }

    const [year, month, day] = parts.map(Number);

    if (!year || !month || !day) {
      return dateValue;
    }

    return new Date(year, month - 1, day).toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  // Convert a backend item into the format used by Angular.
  private mapItem(apiItem: ApiItem): Item {
    return {
      id: String(apiItem.id),
      name: apiItem.name || '',
      category: apiItem.category || 'Other',
      location: apiItem.location || '',
      date: this.formatDate(apiItem.date || ''),
      status: apiItem.status,
      icon: this.getIcon(apiItem.category || 'Other'),
      description: apiItem.description || '',
      contactName: apiItem.contactName || '',
      contactMethod: apiItem.contactMethod || ''
    };
  }

  // Fetch listings from the backend.
  loadItems(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ApiItem[]>(`${this.API_URL}/items`).subscribe({
      next: (response) => {
        this.items = response.map(item => this.mapItem(item));
        this.isLoading = false;
      },

      error: (error) => {
        console.error('Could not load items:', error);

        this.errorMessage =
          'Could not connect to the server. Make sure the backend is running.';

        this.isLoading = false;
      }
    });
  }

  // Search and filter listings.
  get filteredItems(): Item[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.items.filter(item => {
      const searchableText = [
        item.name,
        item.category,
        item.location,
        item.description,
        item.contactName
      ].join(' ').toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const matchesType =
        this.selectedType === 'ALL' ||
        item.status === this.selectedType;

      const matchesCategory =
        this.selectedCategory === 'ALL' ||
        item.category === this.selectedCategory;

      return matchesSearch && matchesType && matchesCategory;
    });
  }

  // Count lost items.
  get lostCount(): number {
    return this.items.filter(item => item.status === 'LOST').length;
  }

  // Count found items.
  get foundCount(): number {
    return this.items.filter(item => item.status === 'FOUND').length;
  }

  // Clear search and filters.
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'ALL';
    this.selectedCategory = 'ALL';
  }

  // Open the Lost or Found report form.
  openReportForm(type: ReportStatus): void {
    this.reportType = type;
    this.newItem = this.createEmptyItem();

    this.showReportForm = true;
    this.showClaimForm = false;
    this.selectedItem = null;
    this.errorMessage = '';

    setTimeout(() => {
      document.getElementById('report-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }

  // Cancel a report.
  cancelReport(): void {
    this.showReportForm = false;
    this.newItem = this.createEmptyItem();
    this.errorMessage = '';
  }

  // Submit a Lost or Found report to the backend.
  submitReport(): void {
    const payload = {
      name: this.newItem.name.trim(),
      category: this.newItem.category,
      location: this.newItem.location.trim(),
      date: this.newItem.date,
      status: this.reportType,
      description: this.newItem.description.trim(),
      contactName: this.newItem.contactName.trim(),
      contactMethod: this.newItem.contactMethod.trim()
    };

    if (
      !payload.name ||
      !payload.category ||
      !payload.location ||
      !payload.date ||
      !payload.contactName ||
      !payload.contactMethod
    ) {
      alert('Please complete all required fields.');
      return;
    }

    this.isSubmittingReport = true;
    this.errorMessage = '';

    this.http.post<ApiResponse>(
      `${this.API_URL}/items`,
      payload
    ).subscribe({
      next: (response) => {
        this.isSubmittingReport = false;
        this.showReportForm = false;
        this.newItem = this.createEmptyItem();

        alert(response.message || 'Report submitted successfully.');

        // Refresh listings after submitting the report.
        this.loadItems();

        setTimeout(() => {
          document.getElementById('browse')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        });
      },

      error: (error) => {
        this.isSubmittingReport = false;

        console.error('Could not submit report:', error);

        alert(
          error.error?.message ||
          'Could not submit your report. Check that the backend is running.'
        );
      }
    });
  }

  // Handle the action button on a listing.
  openClaimForm(item: Item): void {
    this.errorMessage = '';

    // If the listing is LOST, let the user report finding the item.
    if (item.status === 'LOST') {
      this.reportType = 'FOUND';

      this.newItem = {
        ...this.createEmptyItem(),
        name: item.name,
        category: item.category,
        location: item.location,
        description: `Possible match for a lost report: ${item.name}`
      };

      this.showReportForm = true;
      this.showClaimForm = false;
      this.selectedItem = null;

      setTimeout(() => {
        document.getElementById('report-form')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });

      return;
    }

    // If the listing is FOUND, let the owner request to claim it.
    this.selectedItem = item;

    this.claimForm = {
      claimantName: '',
      claimantContact: '',
      identifyingDetails: ''
    };

    this.showClaimForm = true;
    this.showReportForm = false;

    setTimeout(() => {
      document.getElementById('claim-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }

  // Close the claim form.
  cancelClaim(): void {
    this.showClaimForm = false;
    this.selectedItem = null;

    this.claimForm = {
      claimantName: '',
      claimantContact: '',
      identifyingDetails: ''
    };
  }

  // Submit a claim request.
  submitClaim(): void {
    if (!this.selectedItem) {
      alert('Please select a found item first.');
      return;
    }

    const claimantName = this.claimForm.claimantName.trim();
    const claimantContact = this.claimForm.claimantContact.trim();
    const identifyingDetails =
      this.claimForm.identifyingDetails.trim();

    if (
      !claimantName ||
      !claimantContact ||
      !identifyingDetails
    ) {
      alert('Please complete all claim fields.');
      return;
    }

    const payload = {
      itemId: this.selectedItem.id,
      claimantName,
      contactMethod: claimantContact,
      message: identifyingDetails
    };

    this.isSubmittingClaim = true;

    this.http.post<ApiResponse>(
      `${this.API_URL}/claims`,
      payload
    ).subscribe({
      next: (response) => {
        this.isSubmittingClaim = false;
        this.cancelClaim();

        alert(
          response.message ||
          'Your claim request was submitted successfully.'
        );
      },

      error: (error) => {
        this.isSubmittingClaim = false;

        console.error('Could not submit claim:', error);

        alert(
          error.error?.message ||
          'Could not submit the claim request. Please try again.'
        );
      }
    });
  }

  // Delete a listing after the item has been returned or is no longer needed.
 deleteItem(item: Item): void {
  // Prevent duplicate deletion requests for the same item.
  if (this.deletingItemIds.has(item.id)) {
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to delete "${item.name}"?\n\n` +
    'This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  this.deletingItemIds.add(item.id);
  this.errorMessage = '';

  this.http.delete<ApiResponse>(
    `${this.API_URL}/items/${encodeURIComponent(item.id)}`
  ).subscribe({
    next: (response) => {
      // Remove only the deleted listing.
      this.items = this.items.filter(
        existingItem => existingItem.id !== item.id
      );

      // Close the claim form if it refers to the deleted listing.
      if (this.selectedItem?.id === item.id) {
        this.cancelClaim();
      }

      this.deletingItemIds.delete(item.id);

      alert(response.message || 'Listing deleted successfully.');
    },

    error: (error) => {
      console.error('Delete request failed:', error);

      this.deletingItemIds.delete(item.id);

      alert(
        error.error?.message ||
        `Could not delete "${item.name}". Check the backend terminal.`
      );
    }
  });
}
}