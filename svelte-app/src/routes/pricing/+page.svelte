
<script lang="ts">
    import { goto } from '$app/navigation';
    
    // Pricing plan data
    const pricingPlans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    tagline: 'Perfect For Solo Users',
    buttonText: 'Get Started',
    buttonAction: () => goto('/signup?plan=starter'),
    features: [
      '3 Node Silos',
      'Basic AI Task Dump',
      'Manual Node Linking',
      'Limited Resource Summarizer',
      'Export to PDF',
    ]
  },
  {
    name: 'Team',
    price: '$7',
    period: '/month',
    tagline: 'For Collaborative Teams',
    buttonText: 'Get Started',
    buttonAction: () => goto('/signup?plan=team'),
    features: [
      'Unlimited Node Silos',
      'Advanced AI Task Dump',
      'AI-Powered Node Linking',
      'Resource Summarizer & Extractor',
      'Shared Workspaces',
      'Real-Time Collaboration',
      'Priority Support',
    ],
    highlighted: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'For Large Teams & Custom Needs',
    buttonText: 'Contact Us',
    buttonAction: () => goto('/contact?inquiry=enterprise'),
    features: [
      'Everything in Team Plan',
      'Custom Node Types & Templates',
      'Private AI Model Hosting',
      'Team Analytics Dashboard',
      'Custom Integrations & API Access',
      'White-Label Branding',
      'Dedicated Account Manager'
    ]
  }
];
  </script>
  
  <div class="min-h-screen bg-[var(--bg-primary)] p-6 flex flex-col">
    <div class="max-w-5xl mx-auto w-full">
      <div class="text-center mb-12">
        <h1 class="text-3xl font-bold mb-2">Pricing plans</h1>
        <p class="text-[var(--text-secondary)]">Choose the right plan for your needs.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {#each pricingPlans as plan}
          <div class={`rounded-2xl p-6 flex flex-col h-full ${plan.highlighted ? 'bg-[var(--bg-pricing)]' : 'bg-[var(--bg-secondary)]'}`}>
            <!-- Header section with fixed height -->
            <div class="mb-4">
              <div class="mb-2 font-medium text-sm">{plan.name}</div>
              <div class="flex items-end">
                <span class="text-3xl font-bold">{plan.price}</span>
                <span class="text-sm text-[var(--text-secondary)]">{plan.period}</span>
              </div>
              <div class="text-sm mt-2 text-[var(--text-secondary)]">{plan.tagline}</div>
            </div>
            
            <!-- Button section -->
            <button 
              on:click={plan.buttonAction}
              class="py-3 px-4 rounded-full text-sm font-medium mb-6 hover:opacity-90 transition button-theme"
            >
              {plan.buttonText}
            </button>
            
            <!-- Features section -->
            <div class="mt-2">
              <h3 class="font-medium text-sm mb-3">Features include:</h3>
              <div class="space-y-3">
                {#each plan.features as feature}
                  <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2 text-[var(--brand-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">{feature}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>